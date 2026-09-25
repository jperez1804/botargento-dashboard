// Opens the opportunities the bot earned, at read time.
//
// Two openers, chosen by the vertical (docs/crm-oportunidades.md, "Reglas por
// vertical"):
//
//   "handoff" (inbound, the default): a handoff is a fact — the bot qualified
//   this person for this rubro and asked the team to take over. Every handoff
//   of a rubro the person has no open opportunity for becomes one. Plain
//   messages never open anything: in an agency with real volume the board
//   would fill up with "hola". They only keep the person's open opportunities
//   alive and, when they carry a rubro nobody is working, surface the
//   "Consulta nueva" hint.
//
//   "reply" (outbound): WE wrote first. The campaign already chose the person,
//   so the qualification a handoff represents inbound has happened before the
//   first message; the scarce event is that they answer. Every inbound message
//   from a person with no open opportunity opens one, in autoStages.new, with
//   the PROSPECT's rubro (outreach.recipients.vertical, else what they told the
//   wizard). A handoff then pushes it to autoStages.qualified. CRM_SINCE draws
//   the line: replies before it do not open anything, so a tenant that turns
//   the CRM on with months of history starts with a clean board and finds that
//   history under "Sin derivar".
//
// Why on read and not on write: the bot writes automation.* through n8n, so
// the dashboard has no hook there, and a trigger would mean DDL on a schema we
// only read. Every statement is idempotent (ON CONFLICT DO NOTHING against the
// unique indexes from migration 0010), so concurrent renders are safe.
//
// The raw-token → rubro mapping lives in TypeScript (lib/crm/intent.ts) and is
// handed to SQL as a pair of arrays, so the rule stays in one place.

import { sql } from "@/db/client";
import type { CrmConfig } from "@/config/verticals/_types";
import { crmSince } from "@/lib/crm/enabled";
import { crmKinds, leadIntentForTenant } from "@/lib/crm/intent";
import { hasOutreachRecipients, hasOutreachSuppression, hasSessionMemory } from "@/lib/crm/probes";
import { NON_BUSINESS_ESCALATION_TYPES } from "@/lib/queries/handoffs";
import { logger } from "@/lib/logger";

/** raw automation token → vertical intent key, for every value this tenant has. */
export type IntentMap = { raws: string[]; kinds: string[] };

const EMPTY_MAP: IntentMap = { raws: [], kinds: [] };
const MAP_TTL_MS = 10 * 60_000;
let mapCache: { value: IntentMap; at: number } | null = null;

export function invalidateIntentMap(): void {
  mapCache = null;
}

export const isReplyOpener = (config: CrmConfig | null | undefined): boolean =>
  config?.opener === "reply";

/**
 * Every distinct token the tenant stores in escalations.intent,
 * escalations.escalation_type and lead_log.intent, mapped to the vertical's
 * rubro. Tokens that mean nothing commercially ("menu") map to nothing and are
 * left out, which is what makes them unable to open an opportunity.
 *
 * Empty for a reply-opener vertical: there the rubro is the prospect's, not
 * the message's, so no token maps to anything (an outbound handoff is always
 * the same flavour — "wants a demo" — and would only produce a fake rubro).
 */
export async function getIntentMap(now: Date = new Date(), config?: CrmConfig | null): Promise<IntentMap> {
  if (isReplyOpener(config)) return EMPTY_MAP;
  if (mapCache && now.getTime() - mapCache.at < MAP_TTL_MS) return mapCache.value;

  // to_jsonb: not every tenant's escalations table has an `intent` column.
  const rows = await sql<{ raw: string }[]>`
    SELECT DISTINCT raw FROM (
      SELECT NULLIF(to_jsonb(e) ->> 'intent', '') AS raw FROM automation.escalations e
      UNION
      SELECT NULLIF(escalation_type, '') FROM automation.escalations
      UNION
      SELECT NULLIF(intent, '') FROM automation.lead_log
    ) t WHERE raw IS NOT NULL
  `;

  const raws: string[] = [];
  const kinds: string[] = [];
  for (const { raw } of rows) {
    const kind = leadIntentForTenant(raw)?.key;
    if (!kind) continue; // "menu" and friends: not a rubro
    raws.push(raw);
    kinds.push(kind);
  }
  const value = { raws, kinds };
  mapCache = { value, at: now.getTime() };
  return value;
}

/** The rubro of a raw token, as SQL sees it. Pure; mirrors the map above. */
export function kindOf(map: IntentMap, raw: string | null | undefined): string | null {
  if (!raw) return null;
  const i = map.raws.indexOf(raw);
  return i === -1 ? null : (map.kinds[i] ?? null);
}

const idFilter = (waIds?: ReadonlyArray<string>) =>
  waIds && waIds.length > 0 ? [...waIds] : null;

/**
 * Reply mode: the rubro of each PERSON, as CTEs ending in
 * `person_kind(contact_wa_id, kind)`. The campaign that wrote to them says what
 * they are (outreach.recipients.vertical through crm.kindFromCampaign; the
 * latest send wins, because one number can sit in two campaigns); failing
 * that, what they answered the wizard (session snapshot `rubro`, only if it is
 * one of our kinds); failing that, '' — blank, to be filled by hand.
 *
 * Both sources are probed by the caller: an outbound tenant without
 * session_memory, or a fresh one without the outreach schema yet, degrades to
 * '' instead of 42P01. Synchronous on purpose — a postgres.js fragment is
 * thenable, and returning one from an async function would make `await` try
 * to run it.
 */
function personKindCtes(config: CrmConfig, recipients: boolean, snapshot: boolean) {
  const map = config.kindFromCampaign ?? {};
  const fromKeys = Object.keys(map);
  const toKinds = fromKeys.map((k) => map[k]!);
  const kindKeys = crmKinds(config).map((k) => k.key);

  const campaign = recipients
    ? sql`
        SELECT r.wa_id AS contact_wa_id, m.kind
        FROM (
          SELECT DISTINCT ON (wa_id) wa_id, vertical
          FROM outreach.recipients
          ORDER BY wa_id, last_send_at DESC NULLS LAST, id DESC
        ) r
        JOIN unnest(${fromKeys}::text[], ${toKinds}::text[]) AS m(raw, kind) ON m.raw = r.vertical`
    : sql`SELECT NULL::text AS contact_wa_id, NULL::text AS kind WHERE false`;

  const snap = snapshot
    ? sql`
        SELECT s.contact_wa_id, s.qualification_snapshot_json ->> 'rubro' AS kind
        FROM automation.session_memory s
        WHERE (s.qualification_snapshot_json ->> 'rubro') = ANY(${kindKeys}::text[])`
    : sql`SELECT NULL::text AS contact_wa_id, NULL::text AS kind WHERE false`;

  return sql`
    campaign_kind AS (${campaign}),
    snapshot_kind AS (${snap}),
    person_kind AS (
      SELECT p.contact_wa_id,
             COALESCE(
               (SELECT ck.kind FROM campaign_kind ck WHERE ck.contact_wa_id = p.contact_wa_id LIMIT 1),
               (SELECT sk.kind FROM snapshot_kind sk WHERE sk.contact_wa_id = p.contact_wa_id LIMIT 1),
               ''
             ) AS kind
      FROM (SELECT DISTINCT contact_wa_id FROM automation.lead_log WHERE contact_wa_id <> '') p
    )`;
}

/**
 * Everyone who wrote to the bot exists as a contact, so opportunities and
 * events can carry a real foreign key. Returns how many were created.
 *
 * Origin: 'campaign' for somebody we wrote to first (their number is in
 * outreach.recipients), 'whatsapp' for everybody else. Only decided where the
 * outreach schema exists; inbound tenants keep 'whatsapp' for all.
 */
export async function ensureContacts(waIds?: ReadonlyArray<string>): Promise<number> {
  const only = idFilter(waIds);
  const recipients = await hasOutreachRecipients();
  const source = recipients
    ? sql`CASE WHEN EXISTS (SELECT 1 FROM outreach.recipients r WHERE r.wa_id = l.contact_wa_id)
               THEN 'campaign' ELSE 'whatsapp' END`
    : sql`'whatsapp'`;
  const rows = await sql<{ contact_wa_id: string }[]>`
    INSERT INTO dashboard.contacts (contact_wa_id, display_name, source, first_seen_at, created_by, created_at)
    SELECT l.contact_wa_id, '', ${source}, MIN(l.log_timestamp), '', MIN(l.log_timestamp)
    FROM automation.lead_log l
    WHERE l.contact_wa_id <> ''
      ${only ? sql`AND l.contact_wa_id IN ${sql(only)}` : sql``}
      AND NOT EXISTS (
        SELECT 1 FROM dashboard.contacts c WHERE c.contact_wa_id = l.contact_wa_id
      )
    GROUP BY l.contact_wa_id
    ON CONFLICT (contact_wa_id) DO NOTHING
    RETURNING contact_wa_id
  `;
  return rows.length;
}

// Shared by both openers: from candidate_event(contact_wa_id, kind, at) to the
// (person, rubro) pairs no opportunity covers, then the insert. A blank kind
// ('' — reply mode with nothing to go on) matches any open opportunity of the
// person, so it never spawns a twin next to a labelled one.
const uncovered = () => sql`
  SELECT h.contact_wa_id, h.kind, MIN(h.at) AS opened_at
  FROM candidate_event h
  WHERE h.kind IS NOT NULL
    AND EXISTS (SELECT 1 FROM dashboard.contacts c WHERE c.contact_wa_id = h.contact_wa_id)
    -- Already inside an opportunity of that rubro (or an unlabelled one).
    AND NOT EXISTS (
      SELECT 1 FROM dashboard.opportunities o
      WHERE o.contact_wa_id = h.contact_wa_id
        AND (o.kind = h.kind OR o.kind = '' OR h.kind = '')
        AND o.opened_at <= h.at
        AND (o.closed_at IS NULL OR h.at < o.closed_at)
    )
    -- Or the person is already being worked on that rubro right now.
    AND NOT EXISTS (
      SELECT 1 FROM dashboard.opportunities o2
      WHERE o2.contact_wa_id = h.contact_wa_id
        AND o2.closed_at IS NULL
        AND (o2.kind = h.kind OR o2.kind = '' OR h.kind = '')
    )
  GROUP BY h.contact_wa_id, h.kind
`;

const insertCandidates = () => sql`
  INSERT INTO dashboard.opportunities (contact_wa_id, seq, kind, opened_at, opened_by)
  SELECT c.contact_wa_id,
         COALESCE(
           (SELECT MAX(o.seq) FROM dashboard.opportunities o WHERE o.contact_wa_id = c.contact_wa_id),
           0
         ) + ROW_NUMBER() OVER (PARTITION BY c.contact_wa_id ORDER BY c.opened_at, c.kind),
         c.kind, c.opened_at, ''
  FROM candidate c
  ON CONFLICT DO NOTHING
  RETURNING id
`;

/** Handoff mode: the candidates are the person's uncovered handoffs, per rubro. */
async function openFromHandoffs(
  config: CrmConfig,
  only: string[] | null,
  since: Date | null,
): Promise<number> {
  const [map, suppression] = await Promise.all([getIntentMap(new Date(), config), hasOutreachSuppression()]);
  if (map.raws.length === 0) return 0;

  const handoffs = sql`
    SELECT e.contact_wa_id,
           COALESCE(mi.kind, mt.kind) AS kind,
           e.escalation_timestamp AS at
    FROM automation.escalations e
    LEFT JOIN intent_map mi ON mi.raw = to_jsonb(e) ->> 'intent'
    LEFT JOIN intent_map mt ON mt.raw = e.escalation_type
    WHERE e.escalation_type <> ALL(${[...NON_BUSINESS_ESCALATION_TYPES]}::text[])
      AND e.contact_wa_id <> ''
      ${since ? sql`AND e.escalation_timestamp >= ${since.toISOString()}::timestamptz` : sql``}
      ${only ? sql`AND e.contact_wa_id IN ${sql(only)}` : sql``}
      ${suppression
        ? sql`AND NOT EXISTS (SELECT 1 FROM outreach.suppression s WHERE s.wa_id = e.contact_wa_id)`
        : sql``}
  `;

  const rows = await sql<{ id: string }[]>`
    WITH intent_map AS (
      SELECT * FROM unnest(${map.raws}::text[], ${map.kinds}::text[]) AS t(raw, kind)
    ),
    candidate_event AS (${handoffs}),
    candidate AS (${uncovered()})
    ${insertCandidates()}
  `;
  return rows.length;
}

/**
 * Reply mode: the candidates are the person's inbound messages since the
 * cutoff, all carrying the PERSON's rubro. Coverage works as in handoff mode:
 * an open opportunity of that rubro (or an unlabelled one, or an unlabelled
 * candidate) absorbs the message; a message after the last one was closed
 * opens a fresh one.
 */
async function openFromReplies(
  config: CrmConfig,
  only: string[] | null,
  since: Date | null,
): Promise<number> {
  const [suppression, recipients, snapshot] = await Promise.all([
    hasOutreachSuppression(),
    hasOutreachRecipients(),
    hasSessionMemory(),
  ]);
  const kinds = personKindCtes(config, recipients, snapshot);

  const replies = sql`
    SELECT l.contact_wa_id, pk.kind, l.log_timestamp AS at
    FROM automation.lead_log l
    JOIN person_kind pk ON pk.contact_wa_id = l.contact_wa_id
    WHERE l.direction = 'inbound'
      AND l.contact_wa_id <> ''
      ${since ? sql`AND l.log_timestamp >= ${since.toISOString()}::timestamptz` : sql``}
      ${only ? sql`AND l.contact_wa_id IN ${sql(only)}` : sql``}
      ${suppression
        ? sql`AND NOT EXISTS (SELECT 1 FROM outreach.suppression s WHERE s.wa_id = l.contact_wa_id)`
        : sql``}
  `;

  const rows = await sql<{ id: string }[]>`
    WITH ${kinds},
    candidate_event AS (${replies}),
    candidate AS (${uncovered()})
    ${insertCandidates()}
  `;
  return rows.length;
}

/**
 * One opportunity per (person, rubro) event that no opportunity covers yet —
 * a handoff or a reply, depending on the vertical's opener. Returns how many
 * were opened. `since` overrides CRM_SINCE (tests).
 */
export async function ensureOpportunities(
  config: CrmConfig,
  waIds?: ReadonlyArray<string>,
  opts: { since?: Date | null } = {},
): Promise<number> {
  const only = idFilter(waIds);
  const since = opts.since === undefined ? crmSince() : opts.since;
  const opened = isReplyOpener(config)
    ? await openFromReplies(config, only, since)
    : await openFromHandoffs(config, only, since);
  if (opened > 0) {
    logger.info({ opened, opener: config.opener ?? "handoff" }, "Opportunities opened by the sync");
  }
  return opened;
}

/**
 * Gives a rubro to opportunities that have none (kind = ''): migrated before
 * rubros existed, or opened from a reply before the campaign said what the
 * person is. Handoff mode reads the first handoff inside the window; reply
 * mode reads the person's rubro. An opportunity nothing can label keeps ''
 * until somebody edits it.
 */
export async function fillMissingKinds(
  waIds?: ReadonlyArray<string>,
  config?: CrmConfig | null,
): Promise<number> {
  const only = idFilter(waIds);

  if (config && isReplyOpener(config)) {
    const [recipients, snapshot] = await Promise.all([hasOutreachRecipients(), hasSessionMemory()]);
    const kinds = personKindCtes(config, recipients, snapshot);
    const rows = await sql<{ id: string }[]>`
      WITH ${kinds}
      UPDATE dashboard.opportunities o
      SET kind = pk.kind, updated_at = NOW()
      FROM person_kind pk
      WHERE pk.contact_wa_id = o.contact_wa_id
        AND o.kind = ''
        AND pk.kind <> ''
        ${only ? sql`AND o.contact_wa_id IN ${sql(only)}` : sql``}
      RETURNING o.id
    `;
    return rows.length;
  }

  const map = await getIntentMap(new Date(), config);
  if (map.raws.length === 0) return 0;

  const rows = await sql<{ id: string }[]>`
    WITH intent_map AS (
      SELECT * FROM unnest(${map.raws}::text[], ${map.kinds}::text[]) AS t(raw, kind)
    ),
    guess AS (
      SELECT o.id,
             (SELECT COALESCE(mi.kind, mt.kind)
              FROM automation.escalations e
              LEFT JOIN intent_map mi ON mi.raw = to_jsonb(e) ->> 'intent'
              LEFT JOIN intent_map mt ON mt.raw = e.escalation_type
              WHERE e.contact_wa_id = o.contact_wa_id
                AND e.escalation_type <> ALL(${[...NON_BUSINESS_ESCALATION_TYPES]}::text[])
                AND e.escalation_timestamp >= o.opened_at
                AND (o.closed_at IS NULL OR e.escalation_timestamp < o.closed_at)
                AND COALESCE(mi.kind, mt.kind) IS NOT NULL
              ORDER BY e.escalation_timestamp ASC
              LIMIT 1) AS kind
      FROM dashboard.opportunities o
      WHERE o.kind = ''
        ${only ? sql`AND o.contact_wa_id IN ${sql(only)}` : sql``}
    )
    UPDATE dashboard.opportunities o
    SET kind = g.kind, updated_at = NOW()
    FROM guess g
    WHERE o.id = g.id AND g.kind IS NOT NULL
    RETURNING o.id
  `;
  return rows.length;
}

/**
 * The whole read-time sync, in order: the person must exist before their
 * opportunities can. Never throws — a failed sync must not take the board
 * down, it just means a newly qualified lead shows up on the next render.
 */
export async function syncOpportunities(
  config: CrmConfig,
  waIds?: ReadonlyArray<string>,
): Promise<void> {
  try {
    await ensureContacts(waIds);
    await fillMissingKinds(waIds, config);
    await ensureOpportunities(config, waIds);
  } catch (err) {
    logger.error({ err }, "Opportunity sync failed");
  }
}

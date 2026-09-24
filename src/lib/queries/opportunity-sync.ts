// Opens the opportunities the bot earned, at read time.
//
// A handoff is a fact: the bot qualified this person for this rubro and asked
// the team to take over. So every handoff of a rubro the person has no open
// opportunity for becomes one. Plain messages never open anything — in an
// agency with real volume the board would fill up with "hola" — they only keep
// the person's open opportunities alive (see lib/queries/leads.ts) and, when
// they carry a rubro nobody is working, surface the "Consulta nueva" hint.
//
// Why on read and not on write: the bot writes automation.* through n8n, so
// the dashboard has no hook there, and a trigger would mean DDL on a schema we
// only read. Both statements are idempotent (ON CONFLICT DO NOTHING against
// the unique indexes from migration 0010), so concurrent renders are safe.
//
// The raw-token → rubro mapping lives in TypeScript (lib/crm/intent.ts) and is
// handed to SQL as a pair of arrays, so the rule stays in one place.

import { sql } from "@/db/client";
import type { CrmConfig } from "@/config/verticals/_types";
import { leadIntentForTenant } from "@/lib/crm/intent";
import { hasOutreachSuppression } from "@/lib/crm/probes";
import { NON_BUSINESS_ESCALATION_TYPES } from "@/lib/queries/handoffs";
import { logger } from "@/lib/logger";

/** raw automation token → vertical intent key, for every value this tenant has. */
export type IntentMap = { raws: string[]; kinds: string[] };

const MAP_TTL_MS = 10 * 60_000;
let mapCache: { value: IntentMap; at: number } | null = null;

export function invalidateIntentMap(): void {
  mapCache = null;
}

/**
 * Every distinct token the tenant stores in escalations.intent,
 * escalations.escalation_type and lead_log.intent, mapped to the vertical's
 * rubro. Tokens that mean nothing commercially ("menu") map to nothing and are
 * left out, which is what makes them unable to open an opportunity.
 */
export async function getIntentMap(now: Date = new Date()): Promise<IntentMap> {
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
 * Everyone who wrote to the bot exists as a contact, so opportunities and
 * events can carry a real foreign key. Returns how many were created.
 */
export async function ensureContacts(waIds?: ReadonlyArray<string>): Promise<number> {
  const only = idFilter(waIds);
  const rows = await sql<{ contact_wa_id: string }[]>`
    INSERT INTO dashboard.contacts (contact_wa_id, display_name, source, first_seen_at, created_by, created_at)
    SELECT l.contact_wa_id, '', 'whatsapp', MIN(l.log_timestamp), '', MIN(l.log_timestamp)
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

/**
 * One opportunity per (person, rubro) handoff that no opportunity covers yet.
 *
 * A handoff is covered when the person already has an opportunity of that
 * rubro whose window [opened_at, closed_at) contains it, or an OPEN one of
 * that rubro (that handoff belongs to the one being worked). Migrated
 * opportunities with no rubro yet (kind = '') absorb any rubro, and get their
 * own kind filled in below rather than spawning a twin.
 *
 * Returns how many opportunities were opened.
 */
export async function ensureOpportunities(
  config: CrmConfig,
  waIds?: ReadonlyArray<string>,
): Promise<number> {
  const only = idFilter(waIds);
  const [map, suppression] = await Promise.all([getIntentMap(), hasOutreachSuppression()]);
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
      ${only ? sql`AND e.contact_wa_id IN ${sql(only)}` : sql``}
      ${suppression
        ? sql`AND NOT EXISTS (SELECT 1 FROM outreach.suppression s WHERE s.wa_id = e.contact_wa_id)`
        : sql``}
  `;

  const rows = await sql<{ id: string }[]>`
    WITH intent_map AS (
      SELECT * FROM unnest(${map.raws}::text[], ${map.kinds}::text[]) AS t(raw, kind)
    ),
    handoff AS (${handoffs}),
    candidate AS (
      SELECT h.contact_wa_id, h.kind, MIN(h.at) AS opened_at
      FROM handoff h
      WHERE h.kind IS NOT NULL
        AND EXISTS (SELECT 1 FROM dashboard.contacts c WHERE c.contact_wa_id = h.contact_wa_id)
        -- Already inside an opportunity of that rubro (or an unlabelled one).
        AND NOT EXISTS (
          SELECT 1 FROM dashboard.opportunities o
          WHERE o.contact_wa_id = h.contact_wa_id
            AND (o.kind = h.kind OR o.kind = '')
            AND o.opened_at <= h.at
            AND (o.closed_at IS NULL OR h.at < o.closed_at)
        )
        -- Or the person is already being worked on that rubro right now.
        AND NOT EXISTS (
          SELECT 1 FROM dashboard.opportunities o2
          WHERE o2.contact_wa_id = h.contact_wa_id
            AND o2.closed_at IS NULL
            AND (o2.kind = h.kind OR o2.kind = '')
        )
      GROUP BY h.contact_wa_id, h.kind
    )
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
  if (rows.length > 0) {
    logger.info({ opened: rows.length, vertical: config.autoStages.new }, "Opportunities opened from handoffs");
  }
  return rows.length;
}

/**
 * Gives a rubro to opportunities migrated before rubros existed (kind = ''),
 * using the first handoff inside their own window. Runs with the sync; an
 * opportunity whose window holds no handoff keeps '' until somebody edits it.
 */
export async function fillMissingKinds(waIds?: ReadonlyArray<string>): Promise<number> {
  const only = idFilter(waIds);
  const map = await getIntentMap();
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
    await fillMissingKinds(waIds);
    await ensureOpportunities(config, waIds);
  } catch (err) {
    logger.error({ err }, "Opportunity sync failed");
  }
}

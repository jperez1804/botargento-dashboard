// Conversations that never became an opportunity. Inbound verticals: the
// person wrote about something recognisable but the bot never handed them
// over, so nothing opened (see lib/queries/opportunity-sync). Outbound
// verticals (reply opener): they wrote before the CRM was turned on
// (CRM_SINCE), or nothing could be opened for them. They are not lost — they
// live in Conversaciones under "Sin derivar", and Leads shows how many so
// nobody has to remember to look.

import { sql } from "@/db/client";
import type { CrmConfig } from "@/config/verticals/_types";
import { getIntentMap, isReplyOpener } from "@/lib/queries/opportunity-sync";
import { NON_BUSINESS_ESCALATION_TYPES } from "@/lib/queries/handoffs";

export type UnderivedConversation = {
  contactWaId: string;
  displayName: string;
  // Vertical intent key of what they asked about ("Alquileres"), or '' when
  // nothing says (reply mode with no campaign row).
  kind: string;
  lastInboundAt: Date;
};

// No window by default: a conversation that stopped short four months ago is
// still somebody the agency could call. The count is cached like the alert
// banner so opening Leads does not re-scan the message log every time.
const TTL_MS = 60_000;
let countCache: { value: number; at: number } | null = null;

export function invalidateUnderived(): void {
  countCache = null;
}

const recent = (days: number | null) => sql`
  SELECT DISTINCT ON (l.contact_wa_id)
         l.contact_wa_id,
         l.intent,
         l.log_timestamp,
         COALESCE(NULLIF(l.lead_name, ''), NULLIF(l.profile_name, ''), l.contact_wa_id) AS display_name
  FROM automation.lead_log l
  WHERE l.direction = 'inbound'
    AND l.contact_wa_id <> ''
    ${days ? sql`AND l.log_timestamp >= NOW() - ${`${days} days`}::interval` : sql``}
  ORDER BY l.contact_wa_id, l.log_timestamp DESC, l.id DESC
`;

async function selectHandoffMode(
  config: CrmConfig,
  days: number | null,
  limit: number | null,
  offset: number,
): Promise<Record<string, unknown>[]> {
  const map = await getIntentMap(new Date(), config);
  if (map.raws.length === 0) return [];

  return sql<Record<string, unknown>[]>`
    WITH intent_map AS (
      SELECT * FROM unnest(${map.raws}::text[], ${map.kinds}::text[]) AS t(raw, kind)
    ),
    recent AS (${recent(days)})
    SELECT r.contact_wa_id,
           COALESCE(NULLIF(c.display_name, ''), r.display_name) AS display_name,
           im.kind,
           r.log_timestamp AS last_inbound_at
    FROM recent r
    JOIN intent_map im ON im.raw = r.intent
    LEFT JOIN dashboard.contacts c ON c.contact_wa_id = r.contact_wa_id
    WHERE NOT EXISTS (
      SELECT 1 FROM dashboard.opportunities o
      WHERE o.contact_wa_id = r.contact_wa_id AND o.closed_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM automation.escalations e
      WHERE e.contact_wa_id = r.contact_wa_id
        AND e.escalation_type <> ALL(${[...NON_BUSINESS_ESCALATION_TYPES]}::text[])
        ${days ? sql`AND e.escalation_timestamp >= NOW() - ${`${days} days`}::interval` : sql``}
    )
    ORDER BY r.log_timestamp DESC, r.contact_wa_id
    ${limit ? sql`LIMIT ${limit}` : sql``}
    ${offset ? sql`OFFSET ${offset}` : sql``}
  `;
}

// Reply mode: anyone who wrote and has NO opportunity at all — open or closed.
// A handoff does not exclude them: before CRM_SINCE it opened nothing, and
// they are exactly the history the team may want to pick up by hand.
async function selectReplyMode(
  days: number | null,
  limit: number | null,
  offset: number,
): Promise<Record<string, unknown>[]> {
  return sql<Record<string, unknown>[]>`
    WITH recent AS (${recent(days)})
    SELECT r.contact_wa_id,
           COALESCE(NULLIF(c.display_name, ''), r.display_name) AS display_name,
           '' AS kind,
           r.log_timestamp AS last_inbound_at
    FROM recent r
    LEFT JOIN dashboard.contacts c ON c.contact_wa_id = r.contact_wa_id
    WHERE NOT EXISTS (
      SELECT 1 FROM dashboard.opportunities o WHERE o.contact_wa_id = r.contact_wa_id
    )
    ORDER BY r.log_timestamp DESC, r.contact_wa_id
    ${limit ? sql`LIMIT ${limit}` : sql``}
    ${offset ? sql`OFFSET ${offset}` : sql``}
  `;
}

async function select(
  config: CrmConfig,
  days: number | null,
  limit: number | null,
  offset = 0,
): Promise<UnderivedConversation[]> {
  const rows = isReplyOpener(config)
    ? await selectReplyMode(days, limit, offset)
    : await selectHandoffMode(config, days, limit, offset);
  return rows.map((r) => ({
    contactWaId: String(r.contact_wa_id),
    displayName: String(r.display_name),
    kind: String(r.kind ?? ""),
    lastInboundAt: new Date(r.last_inbound_at as string | Date),
  }));
}

// One page of the list. The total is countUnderived(): a chip that counted
// the rows of a capped list said "50 sin derivar" on ventas while the board,
// counting everything, said 154.
export function listUnderivedConversations(
  config: CrmConfig,
  opts: { days?: number; limit?: number; offset?: number } = {},
): Promise<UnderivedConversation[]> {
  return select(config, opts.days ?? null, opts.limit ?? 50, opts.offset ?? 0);
}

/** How many are waiting — the pill above the board and the Conversaciones chip. Cached for a minute. */
export async function countUnderived(config: CrmConfig, now: Date = new Date()): Promise<number> {
  if (countCache && now.getTime() - countCache.at < TTL_MS) return countCache.value;
  const rows = await select(config, null, null);
  countCache = { value: rows.length, at: now.getTime() };
  return rows.length;
}

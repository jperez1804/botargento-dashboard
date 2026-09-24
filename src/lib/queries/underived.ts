// Conversations that never became an opportunity: the person wrote about
// something recognisable but the bot never handed them over, so nothing opened
// (see lib/queries/opportunity-sync). They are not lost — they live in
// Conversaciones under "Sin derivar", and Leads shows how many arrived this
// week so nobody has to remember to look.

import { sql } from "@/db/client";
import { getIntentMap } from "@/lib/queries/opportunity-sync";
import { NON_BUSINESS_ESCALATION_TYPES } from "@/lib/queries/handoffs";

export type UnderivedConversation = {
  contactWaId: string;
  displayName: string;
  // Vertical intent key of what they asked about ("Alquileres").
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

async function select(days: number | null, limit: number | null): Promise<UnderivedConversation[]> {
  const map = await getIntentMap();
  if (map.raws.length === 0) return [];

  const rows = await sql<Record<string, unknown>[]>`
    WITH intent_map AS (
      SELECT * FROM unnest(${map.raws}::text[], ${map.kinds}::text[]) AS t(raw, kind)
    ),
    recent AS (
      SELECT DISTINCT ON (l.contact_wa_id)
             l.contact_wa_id,
             l.intent,
             l.log_timestamp,
             COALESCE(NULLIF(l.lead_name, ''), NULLIF(l.profile_name, ''), l.contact_wa_id) AS display_name
      FROM automation.lead_log l
      WHERE l.direction = 'inbound'
        AND l.contact_wa_id <> ''
        AND NULLIF(l.intent, '') IS NOT NULL
        ${days ? sql`AND l.log_timestamp >= NOW() - ${`${days} days`}::interval` : sql``}
      ORDER BY l.contact_wa_id, l.log_timestamp DESC, l.id DESC
    )
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
    ORDER BY r.log_timestamp DESC
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `;

  return rows.map((r) => ({
    contactWaId: String(r.contact_wa_id),
    displayName: String(r.display_name),
    kind: String(r.kind),
    lastInboundAt: new Date(r.last_inbound_at as string | Date),
  }));
}

export function listUnderivedConversations(
  opts: { days?: number; limit?: number } = {},
): Promise<UnderivedConversation[]> {
  return select(opts.days ?? null, opts.limit ?? 50);
}

/** How many are waiting — the pill above the board. Cached for a minute. */
export async function countUnderived(now: Date = new Date()): Promise<number> {
  if (countCache && now.getTime() - countCache.at < TTL_MS) return countCache.value;
  const rows = await select(null, null);
  countCache = { value: rows.length, at: now.getTime() };
  return rows.length;
}

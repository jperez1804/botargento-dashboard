// Read-side queries for the two-way inbox. automation.v_conversation_control
// exists ONLY on tenants that deployed the inbox schema — every caller must be
// gated behind inboxEnabled() (same pattern as the outreach.v_* views behind
// campaignsTab), and the view is deliberately NOT in REQUIRED_VIEWS.

import { sql } from "@/db/client";

export type ConversationControl = {
  mode: "bot" | "human";
  takenBy: string;
  takenAt: string | null;
  isHumanControlled: boolean;
};

export async function getConversationControl(waId: string): Promise<ConversationControl> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT mode, taken_by, taken_at, is_human_controlled
    FROM automation.v_conversation_control
    WHERE contact_wa_id = ${waId}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return { mode: "bot", takenBy: "", takenAt: null, isHumanControlled: false };
  return {
    mode: String(r.mode) === "human" ? "human" : "bot",
    takenBy: String(r.taken_by ?? ""),
    takenAt: r.taken_at ? new Date(r.taken_at as string | Date).toISOString() : null,
    isHumanControlled: r.is_human_controlled === true,
  };
}

// Single-select quick filters of the /inbox list. 'window' = the 24h reply
// window is still open (the contact wrote in the last 24 hours).
export type InboxFilter = "all" | "unread" | "taken" | "handoff" | "window";

export const INBOX_FILTERS: readonly InboxFilter[] = [
  "all",
  "unread",
  "taken",
  "handoff",
  "window",
] as const;

export type InboxConversation = {
  contactWaId: string;
  displayName: string | null;
  lastSeen: string;
  messageCount: number;
  unread: number;
  mode: "bot" | "human";
  takenBy: string;
  inWindow: boolean;
  handoffCount: number;
};

/**
 * The /inbox list in ONE query: contact summary + unread watermark + takeover
 * state + 24h-window flag, filtered server-side. Cross-schema reads are fine
 * (dashboard_app owns dashboard.* and has SELECT on automation.*); nothing
 * here writes.
 */
export async function listInboxConversations(opts: {
  filter?: InboxFilter;
  q?: string;
  limit?: number;
}): Promise<InboxConversation[]> {
  const { filter = "all", q, limit = 50 } = opts;
  const term = q ? `%${q}%` : null;
  const rows = await sql<Record<string, unknown>[]>`
    SELECT * FROM (
      SELECT
        c.contact_wa_id,
        c.display_name,
        c.last_seen,
        c.total_messages AS message_count,
        c.handoff_count,
        COALESCE(cc.mode, 'bot') AS mode,
        COALESCE(cc.taken_by, '') AS taken_by,
        COALESCE(cc.is_human_controlled, false) AS is_human_controlled,
        (
          SELECT COUNT(*)::int
          FROM automation.lead_log l
          LEFT JOIN dashboard.inbox_read_state r ON r.contact_wa_id = c.contact_wa_id
          WHERE l.contact_wa_id = c.contact_wa_id
            AND l.direction = 'inbound'
            AND l.id > COALESCE(r.last_read_log_id, 0)
        ) AS unread,
        EXISTS (
          SELECT 1 FROM automation.lead_log li
          WHERE li.contact_wa_id = c.contact_wa_id
            AND li.direction = 'inbound'
            AND li.log_timestamp >= NOW() - INTERVAL '24 hours'
        ) AS in_window
      FROM automation.v_contact_summary c
      LEFT JOIN automation.v_conversation_control cc ON cc.contact_wa_id = c.contact_wa_id
      WHERE 1=1
        ${term ? sql`AND (c.display_name ILIKE ${term} OR c.contact_wa_id ILIKE ${term})` : sql``}
    ) t
    WHERE 1=1
      ${filter === "unread" ? sql`AND t.unread > 0` : sql``}
      ${filter === "taken" ? sql`AND t.is_human_controlled` : sql``}
      ${filter === "handoff" ? sql`AND t.handoff_count > 0` : sql``}
      ${filter === "window" ? sql`AND t.in_window` : sql``}
    ORDER BY t.last_seen DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    contactWaId: String(r.contact_wa_id),
    displayName: r.display_name === null ? null : String(r.display_name),
    lastSeen: new Date(r.last_seen as string | Date).toISOString(),
    messageCount: Number(r.message_count ?? 0),
    unread: Number(r.unread ?? 0),
    mode: String(r.mode) === "human" ? "human" : "bot",
    takenBy: String(r.taken_by ?? ""),
    inWindow: r.in_window === true,
    handoffCount: Number(r.handoff_count ?? 0),
  }));
}

/**
 * Total conversations with unread messages — the "Sin leer" chip counter,
 * independent of the active filter/search.
 */
export async function countUnreadConversations(): Promise<number> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT COUNT(*)::int AS n FROM (
      SELECT l.contact_wa_id
      FROM automation.lead_log l
      LEFT JOIN dashboard.inbox_read_state r ON r.contact_wa_id = l.contact_wa_id
      WHERE l.direction = 'inbound'
        AND l.id > COALESCE(r.last_read_log_id, 0)
      GROUP BY l.contact_wa_id
    ) t
  `;
  return Number(rows[0]?.n ?? 0);
}

/**
 * Advances the read watermark for a conversation (WhatsApp semantics: opening
 * the thread marks it read). GREATEST() keeps it monotonic under races.
 * Writes dashboard.* only — the automation invariant holds.
 */
export async function markConversationRead(
  waId: string,
  upToLogId: number,
  email: string,
): Promise<void> {
  if (!Number.isFinite(upToLogId) || upToLogId <= 0) return;
  await sql`
    INSERT INTO dashboard.inbox_read_state (contact_wa_id, last_read_log_id, read_at, read_by)
    VALUES (${waId}, ${upToLogId}, NOW(), ${email})
    ON CONFLICT (contact_wa_id) DO UPDATE
    SET last_read_log_id = GREATEST(dashboard.inbox_read_state.last_read_log_id, EXCLUDED.last_read_log_id),
        read_at = NOW(),
        read_by = EXCLUDED.read_by
  `;
}

export type WindowState = {
  lastInboundAt: string | null;
  inWindow: boolean;
};

/**
 * 24h-window state for the composer, computed in SQL with the SAME predicate
 * the n8n webhook enforces server-side (this copy is UX, not enforcement).
 */
export async function getWindowState(waId: string): Promise<WindowState> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT MAX(log_timestamp) AS last_inbound_at,
           COALESCE(MAX(log_timestamp) >= NOW() - INTERVAL '24 hours', false) AS in_window
    FROM automation.lead_log
    WHERE contact_wa_id = ${waId} AND direction = 'inbound'
  `;
  const r = rows[0];
  return {
    lastInboundAt: r?.last_inbound_at
      ? new Date(r.last_inbound_at as string | Date).toISOString()
      : null,
    inWindow: r?.in_window === true,
  };
}

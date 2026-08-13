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

export type HumanControlledRow = {
  contactWaId: string;
  takenBy: string;
};

/**
 * All currently human-controlled conversations — drives the Tomada/Bot badge
 * on the /inbox list (one query for the whole list, not one per row).
 */
export async function listHumanControlled(): Promise<HumanControlledRow[]> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT contact_wa_id, taken_by
    FROM automation.v_conversation_control
    WHERE is_human_controlled = true
  `;
  return rows.map((r) => ({
    contactWaId: String(r.contact_wa_id),
    takenBy: String(r.taken_by ?? ""),
  }));
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

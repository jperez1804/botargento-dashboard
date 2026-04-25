// Contact list + detail queries against v_contact_summary and lead_log.

import { sql } from "@/db/client";

export type ContactSummary = {
  contactWaId: string;
  displayName: string | null;
  firstSeen: string;
  lastSeen: string;
  messageCount: number;
  lastIntent: string | null;
  handoffCount: number;
};

export type ListContactsParams = {
  search?: string;
  from?: string; // ISO date (YYYY-MM-DD), inclusive
  to?: string; // ISO date (YYYY-MM-DD), inclusive
  limit?: number;
  offset?: number;
};

export type LeadLogEntry = {
  id: number;
  direction: "inbound" | "outbound";
  intent: string | null;
  route: string | null;
  messageText: string | null;
  createdAt: string;
};

function mapContact(r: Record<string, unknown>): ContactSummary {
  return {
    contactWaId: String(r.contact_wa_id),
    displayName: r.display_name === null ? null : String(r.display_name),
    firstSeen: new Date(r.first_seen as string | Date).toISOString(),
    lastSeen: new Date(r.last_seen as string | Date).toISOString(),
    messageCount: Number(r.message_count ?? 0),
    lastIntent: r.last_intent === null ? null : String(r.last_intent),
    handoffCount: Number(r.handoff_count ?? 0),
  };
}

export async function listContacts(params: ListContactsParams): Promise<ContactSummary[]> {
  const { search, from, to, limit = 25, offset = 0 } = params;
  const term = search ? `%${search}%` : null;
  const rows = await sql<Record<string, unknown>[]>`
    SELECT contact_wa_id, display_name, first_seen, last_seen,
           message_count, last_intent, handoff_count
    FROM automation.v_contact_summary
    WHERE 1=1
      ${from ? sql`AND last_seen >= ${from}::date` : sql``}
      ${to ? sql`AND last_seen < (${to}::date + INTERVAL '1 day')` : sql``}
      ${term ? sql`AND (display_name ILIKE ${term} OR contact_wa_id ILIKE ${term})` : sql``}
    ORDER BY last_seen DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map(mapContact);
}

export async function countContacts(params: Omit<ListContactsParams, "limit" | "offset">): Promise<number> {
  const { search, from, to } = params;
  const term = search ? `%${search}%` : null;
  const rows = await sql<Record<string, unknown>[]>`
    SELECT COUNT(*)::int AS n
    FROM automation.v_contact_summary
    WHERE 1=1
      ${from ? sql`AND last_seen >= ${from}::date` : sql``}
      ${to ? sql`AND last_seen < (${to}::date + INTERVAL '1 day')` : sql``}
      ${term ? sql`AND (display_name ILIKE ${term} OR contact_wa_id ILIKE ${term})` : sql``}
  `;
  return Number(rows[0]?.n ?? 0);
}

export async function getContact(waId: string): Promise<ContactSummary | null> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT contact_wa_id, display_name, first_seen, last_seen,
           message_count, last_intent, handoff_count
    FROM automation.v_contact_summary
    WHERE contact_wa_id = ${waId}
    LIMIT 1
  `;
  const row = rows[0];
  return row ? mapContact(row) : null;
}

export async function getConversation(waId: string): Promise<LeadLogEntry[]> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT id, direction, intent, route, message_text, created_at
    FROM automation.lead_log
    WHERE contact_wa_id = ${waId}
    ORDER BY created_at ASC, id ASC
  `;
  return rows.map((r) => {
    const direction = String(r.direction);
    return {
      id: Number(r.id),
      direction: direction === "outbound" ? "outbound" : "inbound",
      intent: r.intent === null ? null : String(r.intent),
      route: r.route === null ? null : String(r.route),
      messageText: r.message_text === null ? null : String(r.message_text),
      createdAt: new Date(r.created_at as string | Date).toISOString(),
    };
  });
}

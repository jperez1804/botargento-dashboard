// Write side of the CRM-lite. dashboard.* only (dashboard_app owns it) — the
// automation.* / outreach.* read-only invariant holds. Every mutation updates
// the lead's current state (lead_state, upsert) and appends to its history
// (lead_events) in one transaction; route handlers add the audit_log row.

//
// Parameter encoding: drizzle(client) (src/db/client.ts) swaps postgres.js's
// json/jsonb and timestamp serializers for identity functions, because drizzle
// serializes those itself. Raw `sql` queries sharing that client must
// therefore pass JSON as a string cast to ::jsonb and dates as ISO strings —
// sql.json(obj) or a Date object would reach the wire unserialized.

import type { Sql, TransactionSql } from "postgres";
import { sql } from "@/db/client";
import type { CrmActivityKind, CrmPriorityKey } from "@/config/verticals/_types";
import { invalidateCrmAlerts } from "@/lib/queries/leads";

async function appendEvent(
  tx: Sql | TransactionSql,
  waId: string,
  kind: string,
  body: string,
  by: string,
  metadata: Record<string, unknown> = {},
  occurredAt: Date | null = null,
): Promise<void> {
  await tx`
    INSERT INTO dashboard.lead_events (contact_wa_id, kind, body, occurred_at, created_by, metadata)
    VALUES (${waId}, ${kind}, ${body},
            COALESCE(${occurredAt ? occurredAt.toISOString() : null}::timestamptz, NOW()), ${by},
            ${JSON.stringify(metadata)}::jsonb)
  `;
}

export async function setLeadStage(
  waId: string,
  stage: string,
  lostReason: string,
  by: string,
  fromStage: string | null,
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO dashboard.lead_state
        (contact_wa_id, stage, stage_changed_at, stage_changed_by, lost_reason, updated_at)
      VALUES (${waId}, ${stage}, NOW(), ${by}, ${lostReason}, NOW())
      ON CONFLICT (contact_wa_id) DO UPDATE
      SET stage = EXCLUDED.stage,
          stage_changed_at = NOW(),
          stage_changed_by = EXCLUDED.stage_changed_by,
          lost_reason = EXCLUDED.lost_reason,
          updated_at = NOW()
    `;
    await appendEvent(tx, waId, "stage_change", lostReason, by, {
      from: fromStage,
      to: stage,
    });
  });
  invalidateCrmAlerts();
}

/**
 * Sets (or clears, with '') the manual priority. Touches ONLY its own columns
 * so stage/owner/reminder upserts and this one never overwrite each other.
 */
/**
 * Sets (or clears, with null) the budget a person typed. Only its own columns,
 * like setLeadPriority, so the other upserts never overwrite it.
 */
export async function setLeadBudget(
  waId: string,
  to: { amount: number; currency: string } | null,
  by: string,
  from: { amount: number; currency: string } | null,
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO dashboard.lead_state
        (contact_wa_id, budget_amount, budget_currency, budget_set_at, budget_set_by, updated_at)
      VALUES (${waId}, ${to ? to.amount : null}, ${to ? to.currency : ""}, NOW(), ${by}, NOW())
      ON CONFLICT (contact_wa_id) DO UPDATE
      SET budget_amount = EXCLUDED.budget_amount,
          budget_currency = EXCLUDED.budget_currency,
          budget_set_at = NOW(),
          budget_set_by = EXCLUDED.budget_set_by,
          updated_at = NOW()
    `;
    await appendEvent(tx, waId, "budget", "", by, { from, to });
  });
  invalidateCrmAlerts();
}

export async function setLeadPriority(
  waId: string,
  priority: CrmPriorityKey | "",
  by: string,
  fromPriority: CrmPriorityKey | null,
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO dashboard.lead_state
        (contact_wa_id, priority, priority_set_at, priority_set_by, updated_at)
      VALUES (${waId}, ${priority}, NOW(), ${by}, NOW())
      ON CONFLICT (contact_wa_id) DO UPDATE
      SET priority = EXCLUDED.priority,
          priority_set_at = NOW(),
          priority_set_by = EXCLUDED.priority_set_by,
          updated_at = NOW()
    `;
    await appendEvent(tx, waId, "priority", "", by, {
      from: fromPriority,
      to: priority || null,
    });
  });
  invalidateCrmAlerts();
}

/**
 * Sets (or clears, with null) the lead's owner. With `onlyIfUnassigned` the
 * write happens only when nobody owns the lead yet — the "Tomar" race guard —
 * and the function returns false when someone got there first.
 */
export async function assignLead(
  waId: string,
  ownerEmail: string | null,
  by: string,
  opts: { onlyIfUnassigned: boolean; fromOwner: string | null },
): Promise<boolean> {
  const applied = await sql.begin(async (tx) => {
    const rows = await tx`
      INSERT INTO dashboard.lead_state
        (contact_wa_id, owner_email, owner_assigned_at, owner_assigned_by, updated_at)
      VALUES (${waId}, ${ownerEmail}, NOW(), ${by}, NOW())
      ON CONFLICT (contact_wa_id) DO UPDATE
      SET owner_email = EXCLUDED.owner_email,
          owner_assigned_at = NOW(),
          owner_assigned_by = EXCLUDED.owner_assigned_by,
          updated_at = NOW()
      ${opts.onlyIfUnassigned ? tx`WHERE dashboard.lead_state.owner_email IS NULL` : tx``}
      RETURNING contact_wa_id
    `;
    if (rows.length === 0) return false;
    await appendEvent(tx, waId, "assignment", "", by, {
      from: opts.fromOwner,
      to: ownerEmail,
    });
    return true;
  });
  if (applied) invalidateCrmAlerts();
  return applied;
}

export async function addLeadActivity(
  waId: string,
  kind: CrmActivityKind,
  body: string,
  occurredAt: Date | null,
  by: string,
): Promise<void> {
  await appendEvent(sql, waId, kind, body, by, {}, occurredAt);
  invalidateCrmAlerts();
}

export async function setLeadReminder(
  waId: string,
  at: Date,
  note: string,
  by: string,
): Promise<void> {
  await sql.begin(async (tx) => {
    // A new date re-arms the WhatsApp notification (notified_at) and reopens
    // the reminder (done_at).
    await tx`
      INSERT INTO dashboard.lead_state
        (contact_wa_id, next_action_at, next_action_note, next_action_set_by, updated_at)
      VALUES (${waId}, ${at.toISOString()}::timestamptz, ${note}, ${by}, NOW())
      ON CONFLICT (contact_wa_id) DO UPDATE
      SET next_action_at = EXCLUDED.next_action_at,
          next_action_note = EXCLUDED.next_action_note,
          next_action_set_by = EXCLUDED.next_action_set_by,
          next_action_notified_at = NULL,
          next_action_done_at = NULL,
          updated_at = NOW()
    `;
    await appendEvent(tx, waId, "reminder_set", note, by, {
      at: at.toISOString(),
    });
  });
  invalidateCrmAlerts();
}

/** Closes the open reminder. Returns false when there was none to close. */
export async function completeLeadReminder(waId: string, by: string): Promise<boolean> {
  const done = await sql.begin(async (tx) => {
    const rows = await tx<{ note: string }[]>`
      UPDATE dashboard.lead_state
      SET next_action_done_at = NOW(), updated_at = NOW()
      WHERE contact_wa_id = ${waId}
        AND next_action_at IS NOT NULL
        AND next_action_done_at IS NULL
      RETURNING next_action_note AS note
    `;
    if (rows.length === 0) return false;
    await appendEvent(tx, waId, "reminder_done", rows[0]?.note ?? "", by);
    return true;
  });
  if (done) invalidateCrmAlerts();
  return done;
}

/**
 * A person replied to / took over the conversation from the inbox. Feeds the
 * automatic "contactado" stage and restarts the inactivity clock. Called by
 * the inbox route handlers after the n8n webhook succeeded.
 */
export async function recordHumanContact(
  waId: string,
  by: string,
  source: "inbox_send" | "inbox_takeover",
): Promise<void> {
  await appendEvent(sql, waId, "contact", "", by, { source });
  invalidateCrmAlerts();
}

export type CreateManualLeadResult = { ok: true } | { ok: false; error: "already_exists" };

/**
 * Registers a lead that did not come through WhatsApp. The phone IS the
 * contact_wa_id, so a person already known — by WhatsApp or registered before
 * — is refused with already_exists instead of duplicated. In one transaction:
 * the manual_leads row, a `created` event (starts the inactivity clock), the
 * optional note, and the lead assigned to whoever registered it.
 */
export async function createManualLead(input: {
  waId: string;
  name: string;
  source: string;
  note: string;
  by: string;
}): Promise<CreateManualLeadResult> {
  const result = await sql.begin(async (tx) => {
    const known = await tx`
      SELECT 1 FROM automation.lead_log WHERE contact_wa_id = ${input.waId} LIMIT 1
    `;
    if (known.length > 0) return { ok: false as const, error: "already_exists" as const };

    const inserted = await tx`
      INSERT INTO dashboard.manual_leads (contact_wa_id, display_name, source, created_by)
      VALUES (${input.waId}, ${input.name}, ${input.source}, ${input.by})
      ON CONFLICT (contact_wa_id) DO NOTHING
      RETURNING contact_wa_id
    `;
    if (inserted.length === 0) return { ok: false as const, error: "already_exists" as const };

    await appendEvent(tx, input.waId, "created", "", input.by, { source: input.source });
    if (input.note) await appendEvent(tx, input.waId, "note", input.note, input.by);
    await tx`
      INSERT INTO dashboard.lead_state
        (contact_wa_id, owner_email, owner_assigned_at, owner_assigned_by, updated_at)
      VALUES (${input.waId}, ${input.by}, NOW(), ${input.by}, NOW())
      ON CONFLICT (contact_wa_id) DO UPDATE
      SET owner_email = COALESCE(dashboard.lead_state.owner_email, EXCLUDED.owner_email),
          updated_at = NOW()
    `;
    return { ok: true as const };
  });
  if (result.ok) invalidateCrmAlerts();
  return result;
}

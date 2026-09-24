// Write side of the CRM-lite. dashboard.* only (dashboard_app owns it) — the
// automation.* / outreach.* read-only invariant holds. Every mutation updates
// one opportunity (dashboard.opportunities) and appends to its history
// (dashboard.lead_events) in one transaction; route handlers add the audit_log
// row.
//
// Every event carries the person (contact_wa_id, the foreign key) and usually
// the opportunity it belongs to; opportunity_id NULL means it is about the
// person, not about one process.
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
import { ensureContacts } from "@/lib/queries/opportunity-sync";
import { hasOutreachSuppression } from "@/lib/crm/probes";

async function appendEvent(
  tx: Sql | TransactionSql,
  waId: string,
  opportunityId: number | null,
  kind: string,
  body: string,
  by: string,
  metadata: Record<string, unknown> = {},
  occurredAt: Date | null = null,
): Promise<void> {
  await tx`
    INSERT INTO dashboard.lead_events
      (contact_wa_id, opportunity_id, kind, body, occurred_at, created_by, metadata)
    VALUES (${waId}, ${opportunityId}, ${kind}, ${body},
            COALESCE(${occurredAt ? occurredAt.toISOString() : null}::timestamptz, NOW()), ${by},
            ${JSON.stringify(metadata)}::jsonb)
  `;
}

/**
 * Moves one opportunity. A terminal stage closes it (closed_at), which is what
 * lets the next handoff for that rubro open a fresh one; moving it back out
 * reopens it.
 */
export async function setOpportunityStage(
  id: number,
  waId: string,
  stage: string,
  lostReason: string,
  by: string,
  fromStage: string | null,
  terminal: boolean,
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      UPDATE dashboard.opportunities
      SET stage = ${stage},
          stage_changed_at = NOW(),
          stage_changed_by = ${by},
          lost_reason = ${lostReason},
          closed_at = ${terminal ? tx`NOW()` : tx`NULL`},
          updated_at = NOW()
      WHERE id = ${id}
    `;
    await appendEvent(tx, waId, id, "stage_change", lostReason, by, {
      from: fromStage,
      to: stage,
    });
  });
  invalidateCrmAlerts();
}

/** Sets (or clears, with null) the budget a person typed. */
export async function setOpportunityBudget(
  id: number,
  waId: string,
  to: { amount: number; currency: string } | null,
  by: string,
  from: { amount: number; currency: string } | null,
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      UPDATE dashboard.opportunities
      SET budget_amount = ${to ? to.amount : null},
          budget_currency = ${to ? to.currency : ""},
          budget_set_at = NOW(),
          budget_set_by = ${by},
          updated_at = NOW()
      WHERE id = ${id}
    `;
    await appendEvent(tx, waId, id, "budget", "", by, { from, to });
  });
  invalidateCrmAlerts();
}

/** Sets (or clears, with '') the manual priority. */
export async function setOpportunityPriority(
  id: number,
  waId: string,
  priority: CrmPriorityKey | "",
  by: string,
  fromPriority: CrmPriorityKey | null,
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      UPDATE dashboard.opportunities
      SET priority = ${priority},
          priority_set_at = NOW(),
          priority_set_by = ${by},
          updated_at = NOW()
      WHERE id = ${id}
    `;
    await appendEvent(tx, waId, id, "priority", "", by, {
      from: fromPriority,
      to: priority || null,
    });
  });
  invalidateCrmAlerts();
}

/** The rubro (and optional title) of an opportunity, corrected by a person. */
export async function setOpportunityKind(
  id: number,
  waId: string,
  kind: string,
  title: string,
  by: string,
  fromKind: string,
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      UPDATE dashboard.opportunities
      SET kind = ${kind}, title = ${title}, updated_at = NOW()
      WHERE id = ${id}
    `;
    await appendEvent(tx, waId, id, "kind_change", title, by, {
      from: fromKind || null,
      to: kind || null,
    });
  });
  invalidateCrmAlerts();
}

/**
 * Sets (or clears, with null) the opportunity's owner. With `onlyIfUnassigned`
 * the write happens only when nobody owns it yet — the "Tomar" race guard —
 * and the function returns false when someone got there first.
 */
export async function assignOpportunity(
  id: number,
  waId: string,
  ownerEmail: string | null,
  by: string,
  opts: { onlyIfUnassigned: boolean; fromOwner: string | null },
): Promise<boolean> {
  const applied = await sql.begin(async (tx) => {
    const rows = await tx`
      UPDATE dashboard.opportunities
      SET owner_email = ${ownerEmail},
          owner_assigned_at = NOW(),
          owner_assigned_by = ${by},
          updated_at = NOW()
      WHERE id = ${id}
        ${opts.onlyIfUnassigned ? tx`AND owner_email IS NULL` : tx``}
      RETURNING id
    `;
    if (rows.length === 0) return false;
    await appendEvent(tx, waId, id, "assignment", "", by, {
      from: opts.fromOwner,
      to: ownerEmail,
    });
    return true;
  });
  if (applied) invalidateCrmAlerts();
  return applied;
}

export async function addOpportunityActivity(
  id: number,
  waId: string,
  kind: CrmActivityKind,
  body: string,
  occurredAt: Date | null,
  by: string,
): Promise<void> {
  await appendEvent(sql, waId, id, kind, body, by, {}, occurredAt);
  invalidateCrmAlerts();
}

export async function setOpportunityReminder(
  id: number,
  waId: string,
  at: Date,
  note: string,
  by: string,
): Promise<void> {
  await sql.begin(async (tx) => {
    // A new date re-arms the WhatsApp notification (notified_at) and reopens
    // the reminder (done_at).
    await tx`
      UPDATE dashboard.opportunities
      SET next_action_at = ${at.toISOString()}::timestamptz,
          next_action_note = ${note},
          next_action_set_by = ${by},
          next_action_notified_at = NULL,
          next_action_done_at = NULL,
          updated_at = NOW()
      WHERE id = ${id}
    `;
    await appendEvent(tx, waId, id, "reminder_set", note, by, { at: at.toISOString() });
  });
  invalidateCrmAlerts();
}

/** Closes the open reminder. Returns false when there was none to close. */
export async function completeOpportunityReminder(
  id: number,
  waId: string,
  by: string,
): Promise<boolean> {
  const done = await sql.begin(async (tx) => {
    const rows = await tx<{ note: string }[]>`
      UPDATE dashboard.opportunities
      SET next_action_done_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
        AND next_action_at IS NOT NULL
        AND next_action_done_at IS NULL
      RETURNING next_action_note AS note
    `;
    if (rows.length === 0) return false;
    await appendEvent(tx, waId, id, "reminder_done", rows[0]?.note ?? "", by);
    return true;
  });
  if (done) invalidateCrmAlerts();
  return done;
}

/**
 * A person replied to / took over the conversation from the inbox. Feeds the
 * automatic "contactado" stage and restarts the inactivity clock. The reply is
 * about the person, so it lands on every opportunity they have open (nothing
 * says which one it was about); with none open it stays on the person alone.
 */
export async function recordHumanContact(
  waId: string,
  by: string,
  source: "inbox_send" | "inbox_takeover",
): Promise<void> {
  await ensureContacts([waId]);
  await sql.begin(async (tx) => {
    const open = await tx<{ id: string }[]>`
      SELECT id FROM dashboard.opportunities
      WHERE contact_wa_id = ${waId} AND closed_at IS NULL
      ORDER BY opened_at DESC
    `;
    if (open.length === 0) {
      await appendEvent(tx, waId, null, "contact", "", by, { source });
      return;
    }
    for (const row of open) {
      await appendEvent(tx, waId, Number(row.id), "contact", "", by, { source });
    }
  });
  invalidateCrmAlerts();
}

export type OpenOpportunityResult =
  | { ok: true; id: number; seq: number }
  | { ok: false; error: "person_not_found" | "opted_out" };

/**
 * Opens an opportunity by hand for a person the dashboard already knows:
 * "Nueva oportunidad" from their card, and the one-click button behind a
 * "Consulta nueva" hint. Assigned to whoever opens it.
 */
export async function openOpportunity(input: {
  waId: string;
  kind: string;
  title: string;
  by: string;
}): Promise<OpenOpportunityResult> {
  await ensureContacts([input.waId]);

  if (await hasOutreachSuppression()) {
    const optedOut = await sql`
      SELECT 1 FROM outreach.suppression WHERE wa_id = ${input.waId} LIMIT 1
    `;
    if (optedOut.length > 0) return { ok: false, error: "opted_out" };
  }

  const run = (): Promise<OpenOpportunityResult> =>
    sql.begin(async (tx) => {
      const known = await tx`
        SELECT 1 FROM dashboard.contacts WHERE contact_wa_id = ${input.waId} LIMIT 1
      `;
      if (known.length === 0) return { ok: false as const, error: "person_not_found" as const };

      const rows = await tx<{ id: string; seq: number }[]>`
        INSERT INTO dashboard.opportunities
          (contact_wa_id, seq, kind, title, opened_at, opened_by,
           owner_email, owner_assigned_at, owner_assigned_by)
        SELECT ${input.waId},
               COALESCE(MAX(o.seq), 0) + 1,
               ${input.kind}, ${input.title}, NOW(), ${input.by},
               ${input.by}, NOW(), ${input.by}
        FROM dashboard.opportunities o
        WHERE o.contact_wa_id = ${input.waId}
        RETURNING id, seq
      `;
      const created = rows[0]!;
      const id = Number(created.id);
      await appendEvent(tx, input.waId, id, "opened", input.title, input.by, {
        kind: input.kind,
        seq: Number(created.seq),
        manual: true,
      });
      return { ok: true as const, id, seq: Number(created.seq) };
    }) as Promise<OpenOpportunityResult>;

  let result: OpenOpportunityResult;
  try {
    result = await run();
  } catch (err) {
    // A concurrent read-time sync took the same seq: recompute once.
    if ((err as { code?: string }).code !== "23505") throw err;
    result = await run();
  }
  if (result.ok) invalidateCrmAlerts();
  return result;
}

export type CreateManualLeadResult =
  | { ok: true; opportunityId: number }
  | { ok: false; error: "already_exists" };

/**
 * Registers a person who did not come through WhatsApp, with their first
 * opportunity. The phone IS the contact_wa_id, so somebody already known — by
 * WhatsApp or registered before — is refused instead of duplicated. In one
 * transaction: the contact, the opportunity (assigned to whoever registers
 * it), a `created` event that starts the inactivity clock, and the optional
 * note.
 */
export async function createManualLead(input: {
  waId: string;
  name: string;
  source: string;
  kind: string;
  note: string;
  by: string;
}): Promise<CreateManualLeadResult> {
  const result = (await sql.begin(async (tx) => {
    const known = await tx`
      SELECT 1 FROM automation.lead_log WHERE contact_wa_id = ${input.waId} LIMIT 1
    `;
    if (known.length > 0) return { ok: false as const, error: "already_exists" as const };

    const inserted = await tx`
      INSERT INTO dashboard.contacts (contact_wa_id, display_name, source, first_seen_at, created_by)
      VALUES (${input.waId}, ${input.name}, ${input.source}, NOW(), ${input.by})
      ON CONFLICT (contact_wa_id) DO NOTHING
      RETURNING contact_wa_id
    `;
    if (inserted.length === 0) return { ok: false as const, error: "already_exists" as const };

    const rows = await tx<{ id: string }[]>`
      INSERT INTO dashboard.opportunities
        (contact_wa_id, seq, kind, opened_at, opened_by,
         owner_email, owner_assigned_at, owner_assigned_by)
      VALUES (${input.waId}, 1, ${input.kind}, NOW(), ${input.by},
              ${input.by}, NOW(), ${input.by})
      RETURNING id
    `;
    const opportunityId = Number(rows[0]!.id);

    await appendEvent(tx, input.waId, opportunityId, "created", "", input.by, {
      source: input.source,
      ...(input.kind ? { kind: input.kind } : {}),
    });
    if (input.note) await appendEvent(tx, input.waId, opportunityId, "note", input.note, input.by);
    return { ok: true as const, opportunityId };
  })) as CreateManualLeadResult;
  if (result.ok) invalidateCrmAlerts();
  return result;
}

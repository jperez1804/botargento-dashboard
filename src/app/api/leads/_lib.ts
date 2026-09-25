// Shared handler for the /api/leads/* routes. Every action: asesor or admin
// (viewers are read-only) → CRM gate (404 when the vertical has no crm) →
// Zod → the lead must exist in automation.lead_log → effect on dashboard.*
// (lib/queries/lead-writes) → audit row in dashboard.audit_log, written even
// when the effect fails.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi, type SessionWithRole } from "@/lib/role-guard";
import { crmConfig } from "@/lib/crm/enabled";
import { getOpportunity, type OpportunityRow } from "@/lib/queries/leads";
import { listAssignableMembers } from "@/lib/queries/team";
import {
  addOpportunityActivity,
  assignOpportunity,
  completeOpportunityReminder,
  setOpportunityBudget,
  setOpportunityKind,
  setOpportunityPriority,
  setOpportunityReminder,
  setOpportunityStage,
} from "@/lib/queries/lead-writes";
import type { CrmConfig, CrmPriorityKey } from "@/config/verticals/_types";
import { crmCurrencies } from "@/lib/crm/budget";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { logger } from "@/lib/logger";
import { crmKinds } from "@/lib/crm/intent";

export type LeadAction =
  | "set-stage"
  | "assign"
  | "event"
  | "reminder-set"
  | "reminder-done"
  | "set-priority"
  | "set-budget"
  | "set-kind";

// Every action names ONE opportunity: a person can have several, so the phone
// is no longer enough to say what to change.
const OppId = z.number().int().positive();
const DAY_MS = 86_400_000;

const Bodies = {
  "set-stage": z.object({
    opportunityId: OppId,
    stage: z.string().min(1).max(40),
    lostReason: z.string().max(200).optional(),
  }),
  assign: z.object({
    opportunityId: OppId,
    // "me" = the caller; null = unassign.
    ownerEmail: z.union([z.literal("me"), z.email(), z.null()]),
    // "Tomar": only succeed if the opportunity is still unassigned.
    take: z.boolean().optional(),
  }),
  event: z.object({
    opportunityId: OppId,
    kind: z.enum(["note", "call", "visit", "meeting"]),
    body: z.string().trim().min(1).max(2000),
    occurredAt: z.iso.datetime({ offset: true }).optional(),
  }),
  "reminder-set": z.object({
    opportunityId: OppId,
    at: z.iso.datetime({ offset: true }),
    note: z.string().trim().max(300),
  }),
  "reminder-done": z.object({ opportunityId: OppId }),
  // "" clears the priority.
  "set-priority": z.object({ opportunityId: OppId, priority: z.enum(["", "alta", "media", "baja"]) }),
  // null amount clears the manual budget (the bot's figure shows again).
  "set-budget": z.object({
    opportunityId: OppId,
    amount: z.number().int().min(1).max(1_000_000_000).nullable(),
    currency: z.string().trim().toUpperCase().max(8).optional(),
  }),
  // "" clears the rubro; the title is free text shown next to it.
  "set-kind": z.object({
    opportunityId: OppId,
    kind: z.string().trim().max(60),
    title: z.string().trim().max(80).optional(),
  }),
} as const;

type Outcome = { status: number; body: Record<string, unknown>; audit: Record<string, unknown> };

const fail = (status: number, error: string, audit: Record<string, unknown> = {}): Outcome => ({
  status,
  body: { error },
  audit: { ...audit, error },
});

async function apply(
  action: LeadAction,
  data: Record<string, unknown>,
  lead: OpportunityRow,
  session: SessionWithRole,
  config: CrmConfig,
): Promise<Outcome> {
  const waId = lead.contactWaId;
  const id = lead.id;
  const now = Date.now();

  if (action === "set-stage") {
    const stage = String(data.stage);
    const def = config.stages.find((s) => s.key === stage);
    if (!def) return fail(400, "invalid_stage", { stage });
    const lostReason =
      stage === config.autoStages.lost ? String(data.lostReason ?? "").trim() : "";
    // A terminal stage closes the opportunity: from here on a new handoff for
    // this rubro opens a fresh one instead of reviving this.
    await setOpportunityStage(
      id,
      waId,
      stage,
      lostReason,
      session.email,
      lead.lead.stage,
      def.terminal === true,
    );
    return { status: 200, body: { ok: true }, audit: { from: lead.lead.stage, to: stage } };
  }

  if (action === "set-kind") {
    const kind = String(data.kind ?? "");
    if (kind && !crmKinds(config).some((i) => i.key === kind)) {
      return fail(400, "invalid_kind", { kind });
    }
    const title = String(data.title ?? lead.title).trim();
    await setOpportunityKind(id, waId, kind, title, session.email, lead.kind);
    return { status: 200, body: { ok: true }, audit: { from: lead.kind || null, to: kind || null } };
  }

  if (action === "set-budget") {
    // Same rule as set-stage: any asesor may edit any lead's budget.
    const amount = data.amount as number | null;
    const currency = amount === null ? "" : String(data.currency ?? "");
    if (amount !== null && !crmCurrencies(config).includes(currency)) {
      return fail(400, "invalid_currency", { currency });
    }
    const from =
      lead.budget?.source === "manual" && lead.budget.amount !== null
        ? { amount: lead.budget.amount, currency: lead.budget.currency }
        : null;
    const to = amount === null ? null : { amount, currency };
    await setOpportunityBudget(id, waId, to, session.email, from);
    return { status: 200, body: { ok: true }, audit: { from, to } };
  }

  if (action === "set-priority") {
    // Same rule as set-stage: any asesor may prioritize any lead.
    const priority = data.priority as CrmPriorityKey | "";
    const to = priority === "" ? null : priority;
    await setOpportunityPriority(id, waId, priority, session.email, lead.lead.priority);
    return { status: 200, body: { ok: true }, audit: { from: lead.lead.priority, to } };
  }

  if (action === "assign") {
    const requested = data.ownerEmail as string | null;
    const target = requested === "me" ? session.email : requested?.toLowerCase() ?? null;
    const current = lead.lead.owner;
    // An asesor manages unassigned leads and their own; reassigning someone
    // else's lead is an admin decision.
    if (session.role !== "admin" && current !== null && current !== session.email) {
      return fail(403, "not_owner", { from: current, to: target });
    }
    if (target !== null) {
      const members = await listAssignableMembers();
      if (!members.some((m) => m.email === target)) return fail(400, "invalid_owner", { to: target });
    }
    const applied = await assignOpportunity(id, waId, target, session.email, {
      onlyIfUnassigned: data.take === true,
      fromOwner: current,
    });
    if (!applied) return fail(409, "already_owned", { to: target });
    return { status: 200, body: { ok: true }, audit: { from: current, to: target } };
  }

  if (action === "event") {
    const occurredAt = data.occurredAt ? new Date(String(data.occurredAt)) : null;
    if (occurredAt && occurredAt.getTime() > now + DAY_MS) return fail(400, "invalid_body");
    const kind = data.kind as "note" | "call" | "visit" | "meeting";
    await addOpportunityActivity(id, waId, kind, String(data.body), occurredAt, session.email);
    return { status: 200, body: { ok: true }, audit: { kind } };
  }

  if (action === "reminder-set") {
    const at = new Date(String(data.at));
    if (at.getTime() > now + 365 * DAY_MS) return fail(400, "invalid_body");
    await setOpportunityReminder(id, waId, at, String(data.note ?? ""), session.email);
    return { status: 200, body: { ok: true }, audit: { at: at.toISOString() } };
  }

  const done = await completeOpportunityReminder(id, waId, session.email);
  if (!done) return fail(409, "no_open_reminder");
  return { status: 200, body: { ok: true }, audit: {} };
}

export function makeLeadHandler(action: LeadAction) {
  return async function POST(request: Request) {
    const auth = await requireRoleApi("asesor");
    if (auth.response) return auth.response;
    const { session } = auth;

    const config = crmConfig();
    if (!config) return NextResponse.json({ error: "not_found" }, { status: 404 });

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const parsed = Bodies[action].safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", issues: z.flattenError(parsed.error) },
        { status: 400 },
      );
    }
    const data = parsed.data as Record<string, unknown>;
    const opportunityId = Number(data.opportunityId);

    let outcome: Outcome;
    let waId: string | null = null;
    try {
      const lead = await getOpportunity(config, opportunityId, new Date());
      waId = lead?.contactWaId ?? null;
      outcome = lead
        ? await apply(action, data, lead, session, config)
        : fail(404, "lead_not_found");
    } catch (err) {
      logger.error({ err, action, email: session.email }, "Lead action failed");
      outcome = fail(500, "internal_error");
    }

    // Audit regardless of outcome — a denied or failed change is still an
    // operator action worth reconstructing.
    try {
      await db.insert(auditLog).values({
        email: session.email,
        action: `lead_${action.replace("-", "_")}`,
        metadata: {
          opportunity_id: opportunityId,
          contact_wa_id: waId,
          ok: outcome.status === 200,
          ...outcome.audit,
        },
      });
    } catch (err) {
      logger.error({ err, action }, "Lead audit insert failed");
    }

    return NextResponse.json(outcome.body, { status: outcome.status });
  };
}

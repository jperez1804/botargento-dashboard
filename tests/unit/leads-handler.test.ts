// Unit tests for the /api/leads/* handler factory: gating, validation, the
// ownership rule, the "Tomar" race (409) and that every attempt is audited.
// DB, auth and the write layer are mocked — the handler logic runs for real.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { realEstate } from "@/config/verticals/real-estate";
import type { OpportunityRow } from "@/lib/queries/leads";

const auditCalls: Array<Record<string, unknown>> = [];
let authResult: { session?: { email: string; role: string }; response?: NextResponse };
let crm: typeof realEstate.crm | null;
let lead: OpportunityRow | null;

const writes = {
  setOpportunityStage: vi.fn(async () => undefined),
  assignOpportunity: vi.fn(async () => true),
  addOpportunityActivity: vi.fn(async () => undefined),
  setOpportunityReminder: vi.fn(async () => undefined),
  completeOpportunityReminder: vi.fn(async () => true),
  setOpportunityPriority: vi.fn(async () => undefined),
  setOpportunityBudget: vi.fn(async () => undefined),
  setOpportunityKind: vi.fn(async () => undefined),
};

vi.mock("@/lib/role-guard", () => ({ requireRoleApi: async () => authResult }));
vi.mock("@/lib/crm/enabled", () => ({ crmConfig: () => crm }));
vi.mock("@/lib/queries/leads", () => ({ getOpportunity: async () => lead }));
vi.mock("@/lib/queries/team", () => ({
  listAssignableMembers: async () => [
    { email: "dev@botargento.com.ar", role: "admin" },
    { email: "asesor@cliente.com", role: "asesor" },
  ],
}));
vi.mock("@/lib/queries/lead-writes", () => writes);
vi.mock("@/db/client", () => ({
  db: {
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        auditCalls.push(v);
        return Promise.resolve();
      },
    }),
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { makeLeadHandler } = await import("@/app/api/leads/_lib");

const WA = "5491155504001";
const OPP = 4001;

function makeLead(overrides: Partial<OpportunityRow["lead"]> = {}): OpportunityRow {
  return {
    contactWaId: WA,
    displayName: "Ramiro",
    firstSeen: null,
    lastMessageAt: null,
    handoffCount: 0,
    budget: null,
    contact: { source: "whatsapp", createdBy: "", createdAt: new Date(), firstSeenAt: null },
    openedAt: new Date("2026-09-01T10:00:00Z"),
    id: 4001,
    seq: 1,
    ofTotal: 1,
    kind: "Ventas",
    title: "",
    openedBy: "",
    closedAt: null,
    newIntent: null,
    lead: {
      stage: "contactado",
      source: "auto",
      stageSince: null,
      lastActivityAt: null,
      daysInactive: null,
      lost: null,
      atRisk: null,
      reminder: null,
      owner: null,
      priority: null,
      closedAt: null,
      ...overrides,
    },
  };
}

const call = (action: Parameters<typeof makeLeadHandler>[0], body: unknown) =>
  makeLeadHandler(action)(
    new Request("http://x/api/leads", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  auditCalls.length = 0;
  Object.values(writes).forEach((f) => f.mockClear());
  writes.assignOpportunity.mockImplementation(async () => true);
  writes.setOpportunityStage.mockImplementation(async () => undefined);
  authResult = { session: { email: "asesor@cliente.com", role: "asesor" } };
  crm = realEstate.crm!;
  lead = makeLead();
});

describe("gating and validation", () => {
  it("passes the role guard's 403 through untouched", async () => {
    authResult = { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
    const res = await call("set-stage", { opportunityId: OPP, stage: "visita" });
    expect(res.status).toBe(403);
    expect(writes.setOpportunityStage).not.toHaveBeenCalled();
  });

  it("answers 404 when the vertical has no CRM", async () => {
    crm = null;
    expect((await call("set-stage", { opportunityId: OPP, stage: "visita" })).status).toBe(404);
  });

  it("rejects invalid JSON and invalid bodies", async () => {
    expect((await call("set-stage", "{nope")).status).toBe(400);
    expect((await call("set-stage", { opportunityId: "abc", stage: "visita" })).status).toBe(400);
  });

  it("answers 404 for an opportunity that does not exist, and audits it", async () => {
    lead = null;
    const res = await call("set-stage", { opportunityId: OPP, stage: "visita" });
    expect(res.status).toBe(404);
    expect(auditCalls[0]).toMatchObject({ action: "lead_set_stage", metadata: { ok: false, error: "lead_not_found" } });
  });
});

describe("set-stage", () => {
  it("refuses a stage outside the vertical pipeline", async () => {
    const res = await call("set-stage", { opportunityId: OPP, stage: "inventada" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_stage" });
    expect(writes.setOpportunityStage).not.toHaveBeenCalled();
  });

  it("writes the stage and audits from → to", async () => {
    const res = await call("set-stage", { opportunityId: OPP, stage: "visita", lostReason: "ignored" });
    expect(res.status).toBe(200);
    expect(writes.setOpportunityStage).toHaveBeenCalledWith(
      OPP,
      WA,
      "visita",
      "",
      "asesor@cliente.com",
      "contactado",
      false,
    );
    expect(auditCalls[0]).toMatchObject({
      email: "asesor@cliente.com",
      action: "lead_set_stage",
      metadata: { opportunity_id: OPP, contact_wa_id: WA, from: "contactado", to: "visita", ok: true },
    });
  });

  it("keeps the motive only when moving to perdido", async () => {
    await call("set-stage", { opportunityId: OPP, stage: "perdido", lostReason: "No responde" });
    expect(writes.setOpportunityStage).toHaveBeenCalledWith(
      OPP,
      WA,
      "perdido",
      "No responde",
      "asesor@cliente.com",
      "contactado",
      true,
    );
  });

  it("still audits when the write blows up", async () => {
    writes.setOpportunityStage.mockImplementation(async () => {
      throw new Error("db down");
    });
    const res = await call("set-stage", { opportunityId: OPP, stage: "visita" });
    expect(res.status).toBe(500);
    expect(auditCalls[0]).toMatchObject({ metadata: { ok: false, error: "internal_error" } });
  });
});

describe("assign", () => {
  it("resolves 'me' to the caller", async () => {
    await call("assign", { opportunityId: OPP, ownerEmail: "me", take: true });
    expect(writes.assignOpportunity).toHaveBeenCalledWith(OPP, WA, "asesor@cliente.com", "asesor@cliente.com", {
      onlyIfUnassigned: true,
      fromOwner: null,
    });
  });

  it("answers 409 when someone took the lead first", async () => {
    writes.assignOpportunity.mockImplementation(async () => false);
    const res = await call("assign", { opportunityId: OPP, ownerEmail: "me", take: true });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_owned" });
  });

  it("stops an asesor from reassigning a colleague's lead", async () => {
    lead = makeLead({ owner: "dev@botargento.com.ar" });
    const res = await call("assign", { opportunityId: OPP, ownerEmail: "me" });
    expect(res.status).toBe(403);
    expect(writes.assignOpportunity).not.toHaveBeenCalled();
  });

  it("lets an admin reassign anyone's lead", async () => {
    authResult = { session: { email: "dev@botargento.com.ar", role: "admin" } };
    lead = makeLead({ owner: "asesor@cliente.com" });
    const res = await call("assign", { opportunityId: OPP, ownerEmail: "dev@botargento.com.ar" });
    expect(res.status).toBe(200);
  });

  it("refuses an owner who cannot own leads", async () => {
    const res = await call("assign", { opportunityId: OPP, ownerEmail: "owner@cliente.com" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_owner" });
  });
});

describe("activities and reminders", () => {
  it("logs an activity", async () => {
    const res = await call("event", { opportunityId: OPP, kind: "call", body: "Llamé, no atendió" });
    expect(res.status).toBe(200);
    expect(writes.addOpportunityActivity).toHaveBeenCalledWith(
      OPP,
      WA,
      "call",
      "Llamé, no atendió",
      null,
      "asesor@cliente.com",
    );
  });

  it("refuses system event kinds from the client", async () => {
    expect((await call("event", { opportunityId: OPP, kind: "stage_change", body: "x" })).status).toBe(400);
  });

  it("schedules a reminder and reports a missing one on done", async () => {
    const at = new Date(Date.now() + 86_400_000).toISOString();
    expect((await call("reminder-set", { opportunityId: OPP, at, note: "Llamar" })).status).toBe(200);
    writes.completeOpportunityReminder.mockImplementation(async () => false);
    const res = await call("reminder-done", { opportunityId: OPP });
    expect(res.status).toBe(409);
  });
});

describe("set-priority", () => {
  it("rejects a level outside alta / media / baja", async () => {
    const res = await call("set-priority", { opportunityId: OPP, priority: "urgente" });
    expect(res.status).toBe(400);
    expect(writes.setOpportunityPriority).not.toHaveBeenCalled();
  });

  it("writes the level and audits from → to (any asesor, no owner rule)", async () => {
    lead = makeLead({ owner: "dev@botargento.com.ar" });
    const res = await call("set-priority", { opportunityId: OPP, priority: "alta" });
    expect(res.status).toBe(200);
    expect(writes.setOpportunityPriority).toHaveBeenCalledWith(OPP, WA, "alta", "asesor@cliente.com", null);
    expect(auditCalls[0]).toMatchObject({
      action: "lead_set_priority",
      metadata: { opportunity_id: OPP, contact_wa_id: WA, from: null, to: "alta", ok: true },
    });
  });

  it("clears the level with an empty string", async () => {
    lead = makeLead({ priority: "media" });
    const res = await call("set-priority", { opportunityId: OPP, priority: "" });
    expect(res.status).toBe(200);
    expect(writes.setOpportunityPriority).toHaveBeenCalledWith(OPP, WA, "", "asesor@cliente.com", "media");
    expect(auditCalls[0]).toMatchObject({ metadata: { from: "media", to: null, ok: true } });
  });

  it("answers 500 and still audits when the write fails", async () => {
    writes.setOpportunityPriority.mockImplementationOnce(async () => {
      throw new Error("db down");
    });
    const res = await call("set-priority", { opportunityId: OPP, priority: "baja" });
    expect(res.status).toBe(500);
    expect(auditCalls[0]).toMatchObject({ action: "lead_set_priority", metadata: { ok: false, error: "internal_error" } });
  });
});

describe("set-budget", () => {
  it("rejects a zero, decimal or oversized amount, and an unknown currency", async () => {
    for (const amount of [0, 1500.5, 1_000_000_001]) {
      expect((await call("set-budget", { opportunityId: OPP, amount, currency: "USD" })).status).toBe(400);
    }
    const res = await call("set-budget", { opportunityId: OPP, amount: 100, currency: "EUR" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_currency" });
    expect(writes.setOpportunityBudget).not.toHaveBeenCalled();
  });

  it("writes the manual budget and audits from → to", async () => {
    const res = await call("set-budget", { opportunityId: OPP, amount: 150000, currency: "usd" });
    expect(res.status).toBe(200);
    expect(writes.setOpportunityBudget).toHaveBeenCalledWith(OPP, WA, { amount: 150000, currency: "USD" }, "asesor@cliente.com", null);
    expect(auditCalls[0]).toMatchObject({
      action: "lead_set_budget",
      metadata: { opportunity_id: OPP, contact_wa_id: WA, from: null, to: { amount: 150000, currency: "USD" }, ok: true },
    });
  });

  it("clears a manual budget with a null amount (the bot's figure shows again)", async () => {
    lead = { ...makeLead(), budget: { amount: 90000, currency: "USD", text: "", source: "manual" } };
    const res = await call("set-budget", { opportunityId: OPP, amount: null });
    expect(res.status).toBe(200);
    expect(writes.setOpportunityBudget).toHaveBeenCalledWith(OPP, WA, null, "asesor@cliente.com", { amount: 90000, currency: "USD" });
    expect(auditCalls[0]).toMatchObject({ metadata: { from: { amount: 90000, currency: "USD" }, to: null, ok: true } });
  });

  it("does not report a bot budget as the previous manual one", async () => {
    lead = { ...makeLead(), budget: { amount: 150000, currency: "USD", text: "", source: "bot" } };
    await call("set-budget", { opportunityId: OPP, amount: 200000, currency: "ARS" });
    expect(writes.setOpportunityBudget).toHaveBeenCalledWith(OPP, WA, { amount: 200000, currency: "ARS" }, "asesor@cliente.com", null);
  });
});

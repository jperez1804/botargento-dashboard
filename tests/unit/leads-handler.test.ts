// Unit tests for the /api/leads/* handler factory: gating, validation, the
// ownership rule, the "Tomar" race (409) and that every attempt is audited.
// DB, auth and the write layer are mocked — the handler logic runs for real.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { realEstate } from "@/config/verticals/real-estate";
import type { LeadRow } from "@/lib/queries/leads";

const auditCalls: Array<Record<string, unknown>> = [];
let authResult: { session?: { email: string; role: string }; response?: NextResponse };
let crm: typeof realEstate.crm | null;
let lead: LeadRow | null;

const writes = {
  setLeadStage: vi.fn(async () => undefined),
  assignLead: vi.fn(async () => true),
  addLeadActivity: vi.fn(async () => undefined),
  setLeadReminder: vi.fn(async () => undefined),
  completeLeadReminder: vi.fn(async () => true),
  setLeadPriority: vi.fn(async () => undefined),
};

vi.mock("@/lib/role-guard", () => ({ requireRoleApi: async () => authResult }));
vi.mock("@/lib/crm/enabled", () => ({ crmConfig: () => crm }));
vi.mock("@/lib/queries/leads", () => ({ getLead: async () => lead }));
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

function makeLead(overrides: Partial<LeadRow["lead"]> = {}): LeadRow {
  return {
    contactWaId: WA,
    displayName: "Ramiro",
    firstSeen: null,
    lastMessageAt: null,
    handoffCount: 0,
    budget: null,
    manual: null,
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
  writes.assignLead.mockImplementation(async () => true);
  writes.setLeadStage.mockImplementation(async () => undefined);
  authResult = { session: { email: "asesor@cliente.com", role: "asesor" } };
  crm = realEstate.crm!;
  lead = makeLead();
});

describe("gating and validation", () => {
  it("passes the role guard's 403 through untouched", async () => {
    authResult = { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
    const res = await call("set-stage", { contactWaId: WA, stage: "visita" });
    expect(res.status).toBe(403);
    expect(writes.setLeadStage).not.toHaveBeenCalled();
  });

  it("answers 404 when the vertical has no CRM", async () => {
    crm = null;
    expect((await call("set-stage", { contactWaId: WA, stage: "visita" })).status).toBe(404);
  });

  it("rejects invalid JSON and invalid bodies", async () => {
    expect((await call("set-stage", "{nope")).status).toBe(400);
    expect((await call("set-stage", { contactWaId: "abc", stage: "visita" })).status).toBe(400);
  });

  it("answers 404 for a contact that is not a lead, and audits it", async () => {
    lead = null;
    const res = await call("set-stage", { contactWaId: WA, stage: "visita" });
    expect(res.status).toBe(404);
    expect(auditCalls[0]).toMatchObject({ action: "lead_set_stage", metadata: { ok: false, error: "lead_not_found" } });
  });
});

describe("set-stage", () => {
  it("refuses a stage outside the vertical pipeline", async () => {
    const res = await call("set-stage", { contactWaId: WA, stage: "inventada" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_stage" });
    expect(writes.setLeadStage).not.toHaveBeenCalled();
  });

  it("writes the stage and audits from → to", async () => {
    const res = await call("set-stage", { contactWaId: WA, stage: "visita", lostReason: "ignored" });
    expect(res.status).toBe(200);
    expect(writes.setLeadStage).toHaveBeenCalledWith(WA, "visita", "", "asesor@cliente.com", "contactado");
    expect(auditCalls[0]).toMatchObject({
      email: "asesor@cliente.com",
      action: "lead_set_stage",
      metadata: { contact_wa_id: WA, from: "contactado", to: "visita", ok: true },
    });
  });

  it("keeps the motive only when moving to perdido", async () => {
    await call("set-stage", { contactWaId: WA, stage: "perdido", lostReason: "No responde" });
    expect(writes.setLeadStage).toHaveBeenCalledWith(WA, "perdido", "No responde", "asesor@cliente.com", "contactado");
  });

  it("still audits when the write blows up", async () => {
    writes.setLeadStage.mockImplementation(async () => {
      throw new Error("db down");
    });
    const res = await call("set-stage", { contactWaId: WA, stage: "visita" });
    expect(res.status).toBe(500);
    expect(auditCalls[0]).toMatchObject({ metadata: { ok: false, error: "internal_error" } });
  });
});

describe("assign", () => {
  it("resolves 'me' to the caller", async () => {
    await call("assign", { contactWaId: WA, ownerEmail: "me", take: true });
    expect(writes.assignLead).toHaveBeenCalledWith(WA, "asesor@cliente.com", "asesor@cliente.com", {
      onlyIfUnassigned: true,
      fromOwner: null,
    });
  });

  it("answers 409 when someone took the lead first", async () => {
    writes.assignLead.mockImplementation(async () => false);
    const res = await call("assign", { contactWaId: WA, ownerEmail: "me", take: true });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_owned" });
  });

  it("stops an asesor from reassigning a colleague's lead", async () => {
    lead = makeLead({ owner: "dev@botargento.com.ar" });
    const res = await call("assign", { contactWaId: WA, ownerEmail: "me" });
    expect(res.status).toBe(403);
    expect(writes.assignLead).not.toHaveBeenCalled();
  });

  it("lets an admin reassign anyone's lead", async () => {
    authResult = { session: { email: "dev@botargento.com.ar", role: "admin" } };
    lead = makeLead({ owner: "asesor@cliente.com" });
    const res = await call("assign", { contactWaId: WA, ownerEmail: "dev@botargento.com.ar" });
    expect(res.status).toBe(200);
  });

  it("refuses an owner who cannot own leads", async () => {
    const res = await call("assign", { contactWaId: WA, ownerEmail: "owner@cliente.com" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_owner" });
  });
});

describe("activities and reminders", () => {
  it("logs an activity", async () => {
    const res = await call("event", { contactWaId: WA, kind: "call", body: "Llamé, no atendió" });
    expect(res.status).toBe(200);
    expect(writes.addLeadActivity).toHaveBeenCalledWith(WA, "call", "Llamé, no atendió", null, "asesor@cliente.com");
  });

  it("refuses system event kinds from the client", async () => {
    expect((await call("event", { contactWaId: WA, kind: "stage_change", body: "x" })).status).toBe(400);
  });

  it("schedules a reminder and reports a missing one on done", async () => {
    const at = new Date(Date.now() + 86_400_000).toISOString();
    expect((await call("reminder-set", { contactWaId: WA, at, note: "Llamar" })).status).toBe(200);
    writes.completeLeadReminder.mockImplementation(async () => false);
    const res = await call("reminder-done", { contactWaId: WA });
    expect(res.status).toBe(409);
  });
});

describe("set-priority", () => {
  it("rejects a level outside alta / media / baja", async () => {
    const res = await call("set-priority", { contactWaId: WA, priority: "urgente" });
    expect(res.status).toBe(400);
    expect(writes.setLeadPriority).not.toHaveBeenCalled();
  });

  it("writes the level and audits from → to (any asesor, no owner rule)", async () => {
    lead = makeLead({ owner: "dev@botargento.com.ar" });
    const res = await call("set-priority", { contactWaId: WA, priority: "alta" });
    expect(res.status).toBe(200);
    expect(writes.setLeadPriority).toHaveBeenCalledWith(WA, "alta", "asesor@cliente.com", null);
    expect(auditCalls[0]).toMatchObject({
      action: "lead_set_priority",
      metadata: { contact_wa_id: WA, from: null, to: "alta", ok: true },
    });
  });

  it("clears the level with an empty string", async () => {
    lead = makeLead({ priority: "media" });
    const res = await call("set-priority", { contactWaId: WA, priority: "" });
    expect(res.status).toBe(200);
    expect(writes.setLeadPriority).toHaveBeenCalledWith(WA, "", "asesor@cliente.com", "media");
    expect(auditCalls[0]).toMatchObject({ metadata: { from: "media", to: null, ok: true } });
  });

  it("answers 500 and still audits when the write fails", async () => {
    writes.setLeadPriority.mockImplementationOnce(async () => {
      throw new Error("db down");
    });
    const res = await call("set-priority", { contactWaId: WA, priority: "baja" });
    expect(res.status).toBe(500);
    expect(auditCalls[0]).toMatchObject({ action: "lead_set_priority", metadata: { ok: false, error: "internal_error" } });
  });
});

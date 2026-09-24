// POST /api/leads/create: registering a lead that did not come through
// WhatsApp. Gating, phone normalization, source validation, the duplicate
// guard (409) and that every attempt is audited. DB and auth are mocked.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { realEstate } from "@/config/verticals/real-estate";

const auditCalls: Array<Record<string, unknown>> = [];
let authResult: { session?: { email: string; role: string }; response?: NextResponse };
let crm: typeof realEstate.crm | null;
const createManualLead = vi.fn(
  async () =>
    ({ ok: true, opportunityId: 7 }) as
      | { ok: true; opportunityId: number }
      | { ok: false; error: "already_exists" },
);

vi.mock("@/lib/role-guard", () => ({ requireRoleApi: async () => authResult }));
vi.mock("@/lib/crm/enabled", () => ({ crmConfig: () => crm }));
vi.mock("@/config/verticals", () => ({ verticalConfig: () => realEstate }));
vi.mock("@/lib/queries/lead-writes", () => ({ createManualLead }));
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

const { POST } = await import("@/app/api/leads/create/route");

const post = (body: unknown) =>
  POST(new Request("http://x/api/leads/create", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  auditCalls.length = 0;
  createManualLead.mockClear();
  createManualLead.mockImplementation(async () => ({ ok: true, opportunityId: 7 }));
  authResult = { session: { email: "asesor@cliente.com", role: "asesor" } };
  crm = realEstate.crm!;
});

describe("POST /api/leads/create", () => {
  it("registers the lead under the normalized WhatsApp id, assigned to whoever loads it", async () => {
    const res = await post({
      phone: "11 5555-0000",
      name: "Laura Paz",
      source: "portal",
      intent: "Ventas",
      note: "Vio el PH",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      contactWaId: "5491155550000",
      opportunityId: 7,
    });
    expect(createManualLead).toHaveBeenCalledWith({
      waId: "5491155550000",
      name: "Laura Paz",
      source: "portal",
      kind: "Ventas",
      note: "Vio el PH",
      by: "asesor@cliente.com",
    });
    expect(auditCalls[0]).toMatchObject({
      action: "lead_create",
      metadata: { contact_wa_id: "5491155550000", source: "portal", ok: true },
    });
  });

  it("stores the rubro as the vertical's key, and demands a valid one", async () => {
    const res = await post({ phone: "11 5555-0000", name: "Laura Paz", source: "portal", intent: "alquileres" });
    expect(res.status).toBe(200);
    expect(createManualLead).toHaveBeenCalledWith(expect.objectContaining({ kind: "Alquileres" }));
    expect(auditCalls[0]).toMatchObject({ metadata: { intent: "Alquileres", ok: true } });

    for (const intent of ["Hipotecas", ""]) {
      createManualLead.mockClear();
      const bad = await post({ phone: "11 5555-0000", name: "Laura Paz", source: "portal", intent });
      expect(bad.status).toBe(400);
      expect(createManualLead).not.toHaveBeenCalled();
    }
  });

  it("refuses a phone that cannot be a WhatsApp number", async () => {
    const res = await post({ phone: "5555", name: "X", source: "portal", intent: "Ventas" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_phone" });
    expect(createManualLead).not.toHaveBeenCalled();
    expect(auditCalls[0]).toMatchObject({ metadata: { ok: false, error: "invalid_phone" } });
  });

  it("refuses an origin that is not in the vertical's list", async () => {
    const res = await post({ phone: "1155550000", name: "X", source: "tiktok", intent: "Ventas" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_source" });
  });

  it("answers 409 with the existing id when the phone is already a lead", async () => {
    createManualLead.mockImplementation(async () => ({ ok: false, error: "already_exists" }));
    const res = await post({ phone: "+54 9 11 5555-0000", name: "Laura", source: "telefono", intent: "Ventas" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_exists", contactWaId: "5491155550000" });
  });

  it("passes the role guard's 403 through and never writes", async () => {
    authResult = { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
    const res = await post({ phone: "1155550000", name: "X", source: "portal", intent: "Ventas" });
    expect(res.status).toBe(403);
    expect(createManualLead).not.toHaveBeenCalled();
  });

  it("answers 404 when the vertical has no CRM", async () => {
    crm = null;
    expect((await post({ phone: "1155550000", name: "X", source: "portal", intent: "Ventas" })).status).toBe(404);
  });

  it("still audits when the write blows up", async () => {
    createManualLead.mockImplementation(async () => {
      throw new Error("db down");
    });
    const res = await post({ phone: "1155550000", name: "X", source: "portal", intent: "Ventas" });
    expect(res.status).toBe(500);
    expect(auditCalls[0]).toMatchObject({ metadata: { ok: false, error: "internal_error" } });
  });
});

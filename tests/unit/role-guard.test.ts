// Unit tests for the first privileged surface (the /settings page) —
// covers session role lookup, viewer-blocking, and audit emission. The DB
// + auth boundaries are mocked so we're exercising the guard logic in
// isolation, not the real Postgres layer.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type AllowedRow = { role: string };

const auditCalls: Array<{ values: unknown }> = [];
const redirectCalls: string[] = [];
let stubSession: { user?: { email?: string | null } } | null = null;
let stubAllowedRows: AllowedRow[] = [];

vi.mock("@/lib/auth", () => ({
  auth: async () => stubSession,
}));

vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => stubAllowedRows,
        }),
      }),
    }),
    insert: () => ({
      values: (vals: unknown) => {
        auditCalls.push({ values: vals });
        return Promise.resolve(undefined);
      },
    }),
  },
}));

vi.mock("drizzle-orm", () => ({ eq: () => ({}) }));

vi.mock("next/navigation", () => ({
  // Mirror Next.js: redirect throws so callers below the call don't continue.
  redirect: (url: string) => {
    redirectCalls.push(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

let getSessionRole: typeof import("@/lib/role-guard").getSessionRole;
let requireRole: typeof import("@/lib/role-guard").requireRole;
let requireRoleApi: typeof import("@/lib/role-guard").requireRoleApi;

beforeEach(async () => {
  auditCalls.length = 0;
  redirectCalls.length = 0;
  stubSession = null;
  stubAllowedRows = [];
  const mod = await import("@/lib/role-guard");
  getSessionRole = mod.getSessionRole;
  requireRole = mod.requireRole;
  requireRoleApi = mod.requireRoleApi;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getSessionRole", () => {
  it("returns null when there is no session", async () => {
    stubSession = null;
    expect(await getSessionRole()).toBeNull();
  });

  it("returns null when the email is absent from the allowlist", async () => {
    stubSession = { user: { email: "stranger@example.com" } };
    stubAllowedRows = [];
    expect(await getSessionRole()).toBeNull();
  });

  it("returns admin role for an admin row", async () => {
    stubSession = { user: { email: "Admin@Cliente.com" } };
    stubAllowedRows = [{ role: "admin" }];
    const result = await getSessionRole();
    expect(result).toEqual({ email: "admin@cliente.com", role: "admin" });
  });

  it("returns viewer role for any unknown row value", async () => {
    stubSession = { user: { email: "viewer@cliente.com" } };
    stubAllowedRows = [{ role: "viewer" }];
    expect((await getSessionRole())?.role).toBe("viewer");

    stubAllowedRows = [{ role: "something_else" }];
    expect((await getSessionRole())?.role).toBe("viewer");
  });

  it("returns asesor role for an asesor row", async () => {
    stubSession = { user: { email: "asesor@cliente.com" } };
    stubAllowedRows = [{ role: "asesor" }];
    expect((await getSessionRole())?.role).toBe("asesor");
  });
});

describe("requireRole ranking (viewer < asesor < admin)", () => {
  it("lets an asesor through requireRole('asesor') without auditing", async () => {
    stubSession = { user: { email: "asesor@cliente.com" } };
    stubAllowedRows = [{ role: "asesor" }];
    expect((await requireRole("asesor")).role).toBe("asesor");
    expect(auditCalls).toHaveLength(0);
  });

  it("lets an admin through requireRole('asesor')", async () => {
    stubSession = { user: { email: "admin@cliente.com" } };
    stubAllowedRows = [{ role: "admin" }];
    expect((await requireRole("asesor")).role).toBe("admin");
  });

  it("blocks an asesor from admin surfaces and audits it", async () => {
    stubSession = { user: { email: "asesor@cliente.com" } };
    stubAllowedRows = [{ role: "asesor" }];
    await expect(requireRole("admin")).rejects.toThrow(/NEXT_REDIRECT:\//);
    expect(auditCalls[0]?.values).toMatchObject({
      action: "role_denied",
      metadata: { required: "admin", actual: "asesor" },
    });
  });

  it("blocks a viewer from asesor surfaces", async () => {
    stubSession = { user: { email: "viewer@cliente.com" } };
    stubAllowedRows = [{ role: "viewer" }];
    await expect(requireRole("asesor")).rejects.toThrow(/NEXT_REDIRECT:\//);
  });
});

describe("requireRoleApi", () => {
  it("answers 401 without a session and never redirects", async () => {
    stubSession = null;
    const result = await requireRoleApi("asesor");
    expect(result.response?.status).toBe(401);
    expect(redirectCalls).toEqual([]);
  });

  it("answers 403 and audits when the role is too low", async () => {
    stubSession = { user: { email: "viewer@cliente.com" } };
    stubAllowedRows = [{ role: "viewer" }];
    const result = await requireRoleApi("asesor");
    expect(result.response?.status).toBe(403);
    expect(redirectCalls).toEqual([]);
    expect(auditCalls).toHaveLength(1);
  });

  it("returns the session when the role is enough", async () => {
    stubSession = { user: { email: "asesor@cliente.com" } };
    stubAllowedRows = [{ role: "asesor" }];
    const result = await requireRoleApi("asesor");
    expect(result.response).toBeUndefined();
    expect(result.session).toEqual({ email: "asesor@cliente.com", role: "asesor" });
  });
});

describe("requireRole", () => {
  it("redirects to /login when there is no session", async () => {
    stubSession = null;
    await expect(requireRole("admin")).rejects.toThrow(/NEXT_REDIRECT:\/login/);
    expect(redirectCalls).toEqual(["/login"]);
    expect(auditCalls).toHaveLength(0);
  });

  it("returns the session for an admin caller without auditing", async () => {
    stubSession = { user: { email: "admin@cliente.com" } };
    stubAllowedRows = [{ role: "admin" }];
    const result = await requireRole("admin");
    expect(result.role).toBe("admin");
    expect(redirectCalls).toEqual([]);
    expect(auditCalls).toHaveLength(0);
  });

  it("redirects a viewer to / and audits role_denied with required vs actual", async () => {
    stubSession = { user: { email: "viewer@cliente.com" } };
    stubAllowedRows = [{ role: "viewer" }];

    await expect(requireRole("admin")).rejects.toThrow(/NEXT_REDIRECT:\//);
    expect(redirectCalls).toEqual(["/"]);
    expect(auditCalls).toHaveLength(1);

    const audit = auditCalls[0]?.values as {
      email: string;
      action: string;
      metadata: { required: string; actual: string };
    };
    expect(audit.email).toBe("viewer@cliente.com");
    expect(audit.action).toBe("role_denied");
    expect(audit.metadata).toEqual({ required: "admin", actual: "viewer" });
  });

  it("does not audit when role is viewer (any authenticated user is allowed)", async () => {
    stubSession = { user: { email: "viewer@cliente.com" } };
    stubAllowedRows = [{ role: "viewer" }];
    const result = await requireRole("viewer");
    expect(result.role).toBe("viewer");
    expect(auditCalls).toHaveLength(0);
  });
});

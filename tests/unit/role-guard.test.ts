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

beforeEach(async () => {
  auditCalls.length = 0;
  redirectCalls.length = 0;
  stubSession = null;
  stubAllowedRows = [];
  const mod = await import("@/lib/role-guard");
  getSessionRole = mod.getSessionRole;
  requireRole = mod.requireRole;
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

  it("returns viewer role for any non-admin row value", async () => {
    stubSession = { user: { email: "viewer@cliente.com" } };
    stubAllowedRows = [{ role: "viewer" }];
    expect((await getSessionRole())?.role).toBe("viewer");

    stubAllowedRows = [{ role: "something_else" }];
    expect((await getSessionRole())?.role).toBe("viewer");
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

// Unit tests for the read + write paths behind the /settings page. The DB
// layer is mocked: we're verifying the wrapper's behaviour (env fallback,
// hex validation, audit-log emission), not Drizzle's INSERT semantics.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StubRow = { primaryColor: string };

const insertCalls: Array<{ table: string; values: unknown }> = [];
let selectRows: StubRow[] = [];

vi.mock("@/db/client", () => {
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectRows,
        }),
      }),
    }),
    insert: () => ({
      values: (vals: unknown) => {
        insertCalls.push({ table: "", values: vals });
        return {
          onConflictDoUpdate: async () => undefined,
          then: (resolve: (v: unknown) => void) => resolve(undefined),
        };
      },
    }),
  };
  return { db };
});

vi.mock("@/lib/env", () => ({
  env: () => ({
    CLIENT_PRIMARY_COLOR: "#abcdef",
    NODE_ENV: "test",
    TENANT_DB_URL: "postgres://stub",
  }),
}));

// drizzle-orm operators are no-ops at the mock layer.
vi.mock("drizzle-orm", () => ({ eq: () => ({}) }));

let getAppSettings: typeof import("@/lib/queries/app-settings").getAppSettings;
let updateAppSettings: typeof import("@/lib/queries/app-settings").updateAppSettings;

beforeEach(async () => {
  insertCalls.length = 0;
  selectRows = [];
  const mod = await import("@/lib/queries/app-settings");
  getAppSettings = mod.getAppSettings;
  updateAppSettings = mod.updateAppSettings;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getAppSettings", () => {
  it("returns the persisted color when the row exists", async () => {
    selectRows = [{ primaryColor: "#112233" }];
    const settings = await getAppSettings();
    expect(settings.primaryColor).toBe("#112233");
  });

  it("falls back to CLIENT_PRIMARY_COLOR when no row exists", async () => {
    selectRows = [];
    const settings = await getAppSettings();
    expect(settings.primaryColor).toBe("#abcdef");
  });

  it("falls back to env when the row exists but primary_color is empty", async () => {
    selectRows = [{ primaryColor: "" }];
    const settings = await getAppSettings();
    expect(settings.primaryColor).toBe("#abcdef");
  });
});

describe("updateAppSettings", () => {
  it("rejects malformed hex values", async () => {
    await expect(updateAppSettings({ primaryColor: "red" }, "dev@test")).rejects.toThrow(
      /Invalid hex/,
    );
    await expect(
      updateAppSettings({ primaryColor: "#abc" }, "dev@test"),
    ).rejects.toThrow(/Invalid hex/);
    await expect(
      updateAppSettings({ primaryColor: "#zzzzzz" }, "dev@test"),
    ).rejects.toThrow(/Invalid hex/);
    await expect(
      updateAppSettings({ primaryColor: "  #112233  " }, "dev@test"),
    ).rejects.toThrow(/Invalid hex/);
  });

  it("rejects an empty acting user", async () => {
    await expect(
      updateAppSettings({ primaryColor: "#112233" }, ""),
    ).rejects.toThrow(/non-empty/);
    await expect(
      updateAppSettings({ primaryColor: "#112233" }, "   "),
    ).rejects.toThrow(/non-empty/);
  });

  it("persists a valid color and emits an audit-log row with from/to", async () => {
    selectRows = [{ primaryColor: "#000000" }];
    const result = await updateAppSettings({ primaryColor: "#FFFFFF" }, "dev@botargento.com.ar");
    expect(result.primaryColor).toBe("#FFFFFF");

    // Two inserts: one into appSettings, one into auditLog.
    expect(insertCalls).toHaveLength(2);

    const auditCall = insertCalls.find(
      (c) =>
        typeof c.values === "object" &&
        c.values !== null &&
        (c.values as { action?: string }).action === "theme_update",
    );
    expect(auditCall).toBeDefined();
    const audit = auditCall!.values as {
      email: string;
      action: string;
      metadata: { from: string; to: string };
    };
    expect(audit.email).toBe("dev@botargento.com.ar");
    expect(audit.metadata.from).toBe("#000000");
    expect(audit.metadata.to).toBe("#FFFFFF");
  });
});

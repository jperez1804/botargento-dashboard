// E2E for the Settings page + role gate. Verifies:
// - Admin (dev@botargento.com.ar — seeded as admin in scripts/seed-dev.ts)
//   sees the "Configuración" nav item, can open /settings, can change the
//   primary color, the change persists across reloads.
// - Viewer (any other allowlisted email — promoted in beforeEach below) does
//   not see the nav item and gets redirected when visiting /settings directly.

import { expect, test } from "@playwright/test";
import path from "node:path";
import postgres from "postgres";
import { loginAsDevViaLog, resetAuthState } from "./helpers";

const LOG_PATH = path.resolve(".playwright-dev-server.log");
const ADMIN_EMAIL = "dev@botargento.com.ar";

test.describe.configure({ mode: "serial" });

async function withSql<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const url = process.env.TENANT_DB_URL;
  if (!url) throw new Error("TENANT_DB_URL is required for settings.spec");
  const sql = postgres(url, { max: 1, idle_timeout: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function getPersistedColor(): Promise<string> {
  return withSql(async (sql) => {
    const rows = await sql`SELECT primary_color FROM dashboard.app_settings WHERE id = 1`;
    return (rows[0]?.primary_color as string) ?? "";
  });
}

async function setPersistedColor(hex: string) {
  await withSql(async (sql) => {
    await sql`
      INSERT INTO dashboard.app_settings (id, primary_color, updated_by)
      VALUES (1, ${hex}, 'e2e-reset')
      ON CONFLICT (id) DO UPDATE SET primary_color = EXCLUDED.primary_color, updated_by = 'e2e-reset', updated_at = NOW()
    `;
  });
}

async function ensureAdmin() {
  // Re-promote dev@ to admin between tests (the viewer test demotes it and
  // a finally block restores it, but be defensive in case Playwright kills
  // the process mid-test).
  await withSql(async (sql) => {
    await sql`
      INSERT INTO dashboard.allowed_emails (email, role, created_by)
      VALUES (${ADMIN_EMAIL}, 'admin', 'e2e-setup')
      ON CONFLICT (email) DO UPDATE SET role = 'admin'
    `;
  });
}

test.beforeEach(async () => {
  await resetAuthState();
  await ensureAdmin();
  // Reset color to a known starting point so assertions don't depend on a
  // previous test run's leftover state.
  await setPersistedColor("#3b82f6");
});

test("Admin sees Configuración nav and can change the primary color", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);

  // The Sidebar entry only renders for admins.
  await expect(page.getByRole("link", { name: "Configuración" })).toBeVisible();

  await page.getByRole("link", { name: "Configuración" }).click();
  await page.waitForURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Configuración" })).toBeVisible();

  // Hex input pre-filled with the persisted seed color.
  const hexInput = page.locator('input[type="text"][maxlength="7"]');
  await expect(hexInput).toHaveValue("#3b82f6");

  // Pick a deliberate, easy-to-spot deep red.
  await hexInput.fill("#8b0000");
  // Discard button now visible because state is dirty.
  await expect(page.getByRole("button", { name: "Descartar" })).toBeEnabled();

  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Color actualizado")).toBeVisible({ timeout: 5_000 });

  // Persisted to dashboard.app_settings.
  expect(await getPersistedColor()).toBe("#8b0000");

  // Reload — the new color comes from DB, not state.
  await page.reload();
  await expect(hexInput).toHaveValue("#8b0000");
});

test("Viewer cannot see the Configuración nav and /settings redirects", async ({ page }) => {
  // Demote dev@ to viewer for this test, then restore.
  await withSql(async (sql) => {
    await sql`UPDATE dashboard.allowed_emails SET role = 'viewer' WHERE email = ${ADMIN_EMAIL}`;
  });

  try {
    await loginAsDevViaLog(page, LOG_PATH);

    await expect(page.getByRole("link", { name: "Configuración" })).toHaveCount(0);

    // Direct visit should redirect away (requireRole audits + bounces to /).
    await page.goto("/settings");
    await page.waitForURL((url) => !url.pathname.startsWith("/settings"));
    expect(new URL(page.url()).pathname).not.toBe("/settings");

    // Audit log should have a role_denied entry for this attempt.
    const denied = await withSql(async (sql) => {
      const rows = await sql`
        SELECT email, action FROM dashboard.audit_log
        WHERE action = 'role_denied' AND email = ${ADMIN_EMAIL}
        ORDER BY created_at DESC LIMIT 1
      `;
      return rows[0] ?? null;
    });
    expect(denied).not.toBeNull();
  } finally {
    // Restore admin role so the next test can use the fixture.
    await withSql(async (sql) => {
      await sql`UPDATE dashboard.allowed_emails SET role = 'admin' WHERE email = ${ADMIN_EMAIL}`;
    });
  }
});

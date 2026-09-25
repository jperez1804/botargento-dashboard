// E2E for Configuración › Equipo: an admin adds a person with a role, name and
// WhatsApp, changes a role, and cannot demote themselves.

import { expect, test } from "@playwright/test";
import path from "node:path";
import postgres from "postgres";
import { loginAsDevViaLog, resetAuthState } from "./helpers";
import { seedCrmState } from "../../scripts/seed-crm";

const LOG_PATH = path.resolve(".playwright-dev-server.log");
const NEW_EMAIL = "nuevo.asesor@cliente.com";

test.describe.configure({ mode: "serial" });

async function withSql<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const url = process.env.TENANT_DB_URL;
  if (!url) throw new Error("TENANT_DB_URL is required for team.spec");
  const sql = postgres(url, { max: 1, idle_timeout: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

test.beforeEach(async ({ page }) => {
  await resetAuthState();
  await withSql(async (sql) => {
    await sql`DELETE FROM dashboard.allowed_emails WHERE email = ${NEW_EMAIL}`;
    await seedCrmState(sql);
  });
  await loginAsDevViaLog(page, LOG_PATH);
});

test.afterAll(async () => {
  await withSql(async (sql) => {
    await sql`DELETE FROM dashboard.allowed_emails WHERE email = ${NEW_EMAIL}`;
    await seedCrmState(sql);
  });
});

test("Admin adds a person as asesor with name and WhatsApp", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("link", { name: /Equipo/ }).click();
  await page.waitForURL("/settings/team");

  const add = page.locator('[data-team-member="new"]');
  await add.getByLabel("Email", { exact: true }).fill(NEW_EMAIL);
  await add.getByLabel("Nombre", { exact: true }).fill("Nuevo Asesor");
  // Typed the way people actually write it: trunk 0 and the local "15"
  // mobile prefix. The number is what the CRM reminder dials, so it is stored
  // as the id WhatsApp uses, and the form says so before saving.
  await add.getByLabel("WhatsApp", { exact: true }).fill("011 15 5555-0000");
  await expect(add.getByTestId("team-wa-preview")).toContainText("+54 9 1155550000");
  await add.getByRole("button", { name: "Agregar" }).click();

  await expect(page.locator(`[data-team-member="${NEW_EMAIL}"]`)).toBeVisible();
  const rows = await withSql(
    (sql) => sql`
      SELECT a.role, t.display_name, t.whatsapp_number
      FROM dashboard.allowed_emails a JOIN dashboard.team_members t USING (email)
      WHERE a.email = ${NEW_EMAIL}
    `,
  );
  expect(rows[0]).toMatchObject({
    role: "asesor",
    display_name: "Nuevo Asesor",
    whatsapp_number: "5491155550000",
  });
});

test("Admin changes a role; their own role is locked", async ({ page }) => {
  await page.goto("/settings/team");
  const asesor = page.locator('[data-team-member="asesor@cliente.com"]');
  await asesor.getByLabel("Rol", { exact: true }).selectOption("viewer");
  await asesor.getByRole("button", { name: "Guardar" }).click();
  await expect
    .poll(() =>
      withSql(async (sql) => {
        const r = await sql`SELECT role FROM dashboard.allowed_emails WHERE email = 'asesor@cliente.com'`;
        return r[0]?.role;
      }),
    )
    .toBe("viewer");

  const self = page.locator('[data-team-member="dev@botargento.com.ar"]');
  await expect(self.getByLabel("Rol", { exact: true })).toBeDisabled();
});

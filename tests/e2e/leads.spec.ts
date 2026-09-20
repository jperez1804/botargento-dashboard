// E2E for the CRM-lite: /leads list + board, the CRM card on a conversation,
// the attention banner, and the role split (admin / asesor / viewer). The
// dashboard-side CRM state is reset to the seed baseline before every test
// (scripts/seed-crm.ts → seedCrmState), so tests don't leak moves.

import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import postgres from "postgres";
import { loginAsDevViaLog, resetAuthState } from "./helpers";
import { CRM_FIXTURES as F, seedCrmState } from "../../scripts/seed-crm";

const LOG_PATH = path.resolve(".playwright-dev-server.log");
const ADMIN = "dev@botargento.com.ar";
const ASESOR = "asesor@cliente.com";
const VIEWER = "owner@cliente.com";

test.describe.configure({ mode: "serial" });

async function withSql<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const url = process.env.TENANT_DB_URL;
  if (!url) throw new Error("TENANT_DB_URL is required for leads.spec");
  const sql = postgres(url, { max: 1, idle_timeout: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

const leadRows = (page: Page) => page.locator('a[aria-label^="Leads: "]');

test.beforeEach(async () => {
  await resetAuthState();
  await withSql((sql) => seedCrmState(sql));
});

test("Banner surfaces at-risk leads and overdue reminders for the admin", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  const banner = page.getByTestId("crm-alert-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("1 lead pasa a perdido");
  await expect(banner).toContainText("1 recordatorio vencido");

  await banner.getByRole("link", { name: /pasa a perdido/ }).click();
  await page.waitForURL(/filter=at_risk/);
  await expect(leadRows(page)).toHaveCount(1);
  await expect(leadRows(page).first()).toContainText(F.atRisk.name);
  await expect(leadRows(page).first()).toContainText("Pasa a perdido el");
});

test("Seguimiento lists open reminders, overdue first", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/follow-up");
  const list = page.getByTestId("reminders-list");
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list.getByRole("listitem").first()).toContainText(F.overdue.name);
  await expect(list.getByRole("listitem").first()).toContainText("Vencido");
  await expect(list.getByRole("listitem").nth(1)).toContainText(F.upcoming.name);
});

test("Leads list derives stages, hides lost leads and filters by owner", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads?view=list");
  await expect(leadRows(page).filter({ hasText: F.visita.name })).toContainText("Visita");
  await expect(leadRows(page).filter({ hasText: F.contacted.name })).toContainText("Contactado");
  // 40 idle days → perdido (auto), hidden unless the stage filter asks for it.
  await expect(leadRows(page).filter({ hasText: F.lost.name })).toHaveCount(0);

  await page.locator('button[data-stage="perdido"]').click();
  await page.waitForURL(/stage=perdido/);
  await expect(leadRows(page).filter({ hasText: F.lost.name })).toContainText("sin actividad");

  await page.goto("/leads?view=list&mine=1");
  await expect(leadRows(page)).toHaveCount(2);
  await expect(page.getByText(F.visita.name)).toBeVisible();
  await expect(page.getByText(F.overdue.name)).toBeVisible();
});

test("Leads opens on the board and the tabs switch views", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads");
  await expect(page.locator("[data-board-column]")).toHaveCount(7);

  const tabs = page.getByTestId("leads-view-tabs");
  await expect(tabs.getByRole("link", { name: "Tablero" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Lista" }).click();
  await page.waitForURL(/view=list/);
  await expect(leadRows(page).first()).toBeVisible();
  await expect(page.locator("[data-board-column]")).toHaveCount(0);

  // Filters survive the switch back to the board.
  await page.goto("/leads?view=list&mine=1");
  await page.getByTestId("leads-view-tabs").getByRole("link", { name: "Tablero" }).click();
  await page.waitForURL(/mine=1/);
  await expect(page.locator("[data-board-column]")).toHaveCount(7);
});

test("Board moves a lead from the ⋯ menu and audits the change", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads?view=board");
  await expect(page.locator("[data-board-column]")).toHaveCount(7);

  const card = page.locator(`[data-lead-card="${F.contacted.wa_id}"]`);
  await expect(page.locator('[data-board-column="contactado"]')).toContainText(F.contacted.name);
  await card.getByTestId("lead-menu").click();
  await page.getByRole("menuitem", { name: "Visita", exact: true }).click();
  await expect(page.locator('[data-board-column="visita"]')).toContainText(F.contacted.name);

  await expect
    .poll(() =>
      withSql(async (sql) => {
        const rows = await sql`SELECT stage FROM dashboard.lead_state WHERE contact_wa_id = ${F.contacted.wa_id}`;
        return rows[0]?.stage ?? null;
      }),
    )
    .toBe("visita");
  const audit = await withSql(
    (sql) => sql`SELECT metadata FROM dashboard.audit_log WHERE action = 'lead_set_stage' ORDER BY id DESC LIMIT 1`,
  );
  expect(audit[0]?.metadata).toMatchObject({
    contact_wa_id: F.contacted.wa_id,
    from: "contactado",
    to: "visita",
    ok: true,
  });
});

test("Board assigns an owner from the avatar menu", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads?view=board");

  const card = page.locator(`[data-lead-card="${F.atRisk.wa_id}"]`);
  await card.getByTestId("lead-assign").click();
  await page.getByRole("menuitem", { name: "Ana Asesora" }).click();
  // The avatar now carries her initials instead of the unassigned placeholder.
  await expect(card.getByTestId("lead-assign")).toContainText("AA");

  await expect
    .poll(() =>
      withSql(async (sql) => {
        const rows = await sql`SELECT owner_email FROM dashboard.lead_state WHERE contact_wa_id = ${F.atRisk.wa_id}`;
        return rows[0]?.owner_email ?? null;
      }),
    )
    .toBe(ASESOR);
  const audit = await withSql(
    (sql) => sql`SELECT metadata FROM dashboard.audit_log WHERE action = 'lead_assign' ORDER BY id DESC LIMIT 1`,
  );
  expect(audit[0]?.metadata).toMatchObject({ contact_wa_id: F.atRisk.wa_id, to: ASESOR, ok: true });
});

test("Lead card: take the lead, log a call and schedule a reminder", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto(`/conversations/${F.atRisk.wa_id}`);
  const card = page.getByTestId("lead-crm-card");
  await expect(card).toContainText("Nuevo");
  await expect(card.getByTestId("lead-status")).toContainText("Pasa a perdido el");

  // "Tomar" is a two-click confirm whose pill auto-reverts after 4s — on a
  // cold dev server the second click can miss that window, so retry the pair.
  await expect(async () => {
    const take = card.getByTestId("lead-take");
    if (await take.isVisible()) await take.click();
    await card.getByRole("button", { name: "¿Tomar este lead?" }).click({ timeout: 3000 });
    await expect(card.getByTestId("lead-owner")).toHaveText("Dev Admin", { timeout: 5000 });
  }).toPass({ timeout: 30_000 });

  const activity = page.getByTestId("lead-activity");
  await activity.getByTestId("lead-activity-body").fill("Le ofrecí dos PH en Villa Crespo");
  await activity.getByRole("combobox").selectOption("call");
  await activity.getByTestId("lead-activity-submit").click();
  await expect(activity).toContainText("Le ofrecí dos PH en Villa Crespo");
  // Logging activity restarts the inactivity clock: no longer "por vencer".
  await expect(card.getByTestId("lead-status")).toHaveCount(0);

  const tomorrow = new Date(Date.now() + 86_400_000);
  const local = `${tomorrow.toISOString().slice(0, 10)}T10:30`;
  await card.locator('input[type="datetime-local"]').fill(local);
  await card.getByPlaceholder("Ej.: llamar para coordinar la visita").fill("Confirmar visita");
  await card.getByRole("button", { name: "Guardar recordatorio" }).click();
  await expect(card.getByTestId("lead-reminder")).toContainText("Confirmar visita");

  const state = await withSql(
    (sql) => sql`SELECT owner_email, next_action_note FROM dashboard.lead_state WHERE contact_wa_id = ${F.atRisk.wa_id}`,
  );
  expect(state[0]).toMatchObject({ owner_email: ADMIN, next_action_note: "Confirmar visita" });
});

test("Qualification card shows what the bot captured", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  const rows = await withSql(
    (sql) => sql`SELECT contact_wa_id FROM automation.escalations WHERE target_zone = 'Palermo' LIMIT 1`,
  );
  await page.goto(`/conversations/${rows[0]?.contact_wa_id}`);
  const qual = page.getByTestId("lead-qualification");
  await expect(qual).toContainText("Palermo");
  await expect(qual).toContainText("USD 150.000");
  await expect(qual).toContainText("USD 120k – 160k");
  await expect(page.getByTestId("lead-crm-card")).toContainText("Calificado");
});

test("Asesor manages leads but cannot touch Settings or someone else's lead", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH, ASESOR);
  await expect(page.getByRole("link", { name: "Leads", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Configuración" })).toHaveCount(0);
  // The asesor's own leads have nothing overdue or about to expire.
  await expect(page.getByTestId("crm-alert-banner")).toHaveCount(0);

  await page.goto(`/conversations/${F.reserva.wa_id}`);
  await expect(page.getByTestId("lead-stage-select")).toBeVisible();

  // On the board: can claim an unassigned lead, but a colleague's lead shows
  // a plain avatar with no assign menu (mirrors the API's not_owner rule).
  await page.goto("/leads?view=board");
  await expect(
    page.locator(`[data-lead-card="${F.atRisk.wa_id}"]`).getByTestId("lead-assign"),
  ).toBeVisible();
  await expect(
    page.locator(`[data-lead-card="${F.visita.wa_id}"]`).getByTestId("lead-assign"),
  ).toHaveCount(0);

  const res = await page.request.post("/api/leads/assign", {
    data: { contactWaId: F.visita.wa_id, ownerEmail: "me" },
  });
  expect(res.status()).toBe(403);
  expect(await res.json()).toMatchObject({ error: "not_owner" });

  await page.goto("/settings");
  await page.waitForURL("/");
});

test("Viewer reads leads without controls and the API refuses writes", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH, VIEWER);
  await page.goto("/leads?view=list");
  await expect(leadRows(page).first()).toBeVisible();

  await page.goto("/leads?view=board");
  await expect(page.locator(`[data-lead-card="${F.visita.wa_id}"]`)).toBeVisible();
  await expect(page.getByTestId("lead-menu")).toHaveCount(0);
  await expect(page.getByTestId("lead-assign")).toHaveCount(0);

  await page.goto(`/conversations/${F.visita.wa_id}`);
  await expect(page.getByTestId("lead-crm-card")).toContainText("Visita");
  await expect(page.getByTestId("lead-stage-select")).toHaveCount(0);

  const res = await page.request.post("/api/leads/set-stage", {
    data: { contactWaId: F.visita.wa_id, stage: "cerrado" },
  });
  expect(res.status()).toBe(403);
});

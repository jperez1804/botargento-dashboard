// E2E for the CRM-lite: /leads list + board, the CRM card on a conversation,
// the attention banner, and the role split (admin / asesor / viewer). The
// dashboard-side CRM state is reset to the seed baseline before every test
// (scripts/seed-crm.ts → seedCrmState), so tests don't leak moves.

import { expect as baseExpect, test, type Page } from "@playwright/test";

// The CRM controls save then router.refresh(): the board and the modal
// re-render server-side, which on a cold dev server (and on CI) can take
// more than the 5s default before an assertion sees the new state.
const expect = baseExpect.configure({ timeout: 15_000 });
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

// What <input type="date"> holds for a Date, in the browser's local calendar
// (the runner and the browser share the machine, so local here = local there).
const localDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// The audit row is written after the handler's transaction commits, so a test
// that just saw the state change must poll for it rather than read once.
const lastAudit = (action: string) =>
  withSql(async (sql) => {
    const rows = await sql`SELECT metadata FROM dashboard.audit_log WHERE action = ${action} ORDER BY id DESC LIMIT 1`;
    return rows[0]?.metadata ?? null;
  });

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
  await expect(leadRows(page).first()).toContainText("Se pierde el");
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
  await expect(page.locator("[data-board-column]")).toHaveCount(5);

  const tabs = page.getByTestId("leads-view-tabs");
  await expect(tabs.getByRole("link", { name: "Tablero" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Lista" }).click();
  await page.waitForURL(/view=list/);
  await expect(leadRows(page).first()).toBeVisible();
  await expect(page.locator("[data-board-column]")).toHaveCount(0);
  // The list uses the full width too, not just the board.
  await expect(page.locator("[data-board-bleed]")).toHaveCount(1);

  // Filters survive the switch back to the board.
  await page.goto("/leads?view=list&mine=1");
  await page.getByTestId("leads-view-tabs").getByRole("link", { name: "Tablero" }).click();
  await page.waitForURL(/mine=1/);
  await expect(page.locator("[data-board-column]")).toHaveCount(5);
});

test("Board moves a lead from the ⋯ menu and audits the change", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads?view=board");
  await expect(page.locator("[data-board-column]")).toHaveCount(5);

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
  await expect.poll(() => lastAudit("lead_set_stage")).toMatchObject({
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
  await expect.poll(() => lastAudit("lead_assign")).toMatchObject({ contact_wa_id: F.atRisk.wa_id, to: ASESOR, ok: true });
});

test("Lead card: take the lead, log a call and schedule a reminder", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto(`/conversations/${F.atRisk.wa_id}`);
  const card = page.getByTestId("lead-crm-card");
  await expect(card).toContainText("Nuevo");
  await expect(card.getByTestId("lead-status")).toContainText("Se pierde el");

  // "Tomar" saves at once; the toast offers Deshacer, which gives it back.
  // On a cold dev server the first click can land before hydration, so the
  // pair (click → owner shown) is retried.
  const taken = page.locator("[data-sonner-toast]").filter({ hasText: "Es tuyo" });
  await expect(async () => {
    const take = card.getByTestId("lead-take");
    if (await take.isVisible()) await take.click();
    await expect(taken).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 30_000 });
  await expect(card.getByTestId("lead-owner")).toHaveText("Dev Admin");
  await taken.getByRole("button", { name: "Deshacer" }).click();
  await expect(card.getByTestId("lead-owner")).toHaveCount(0);
  await expect(card.getByTestId("lead-take")).toBeVisible();
  await card.getByTestId("lead-take").click();
  await expect(card.getByTestId("lead-owner")).toHaveText("Dev Admin");

  // The kind comes first; the button and the placeholder follow it.
  const activity = page.getByTestId("lead-activity");
  await expect(activity.getByTestId("lead-activity-submit")).toHaveText("Guardar nota");
  await activity.getByTestId("activity-kind-call").click();
  await expect(activity.getByTestId("lead-activity-submit")).toHaveText("Guardar llamada");
  await expect(activity.getByTestId("lead-activity-body")).toHaveAttribute("placeholder", /Qué hablaron/);
  await activity.getByTestId("lead-activity-body").fill("Le ofrecí dos PH en Villa Crespo");
  await activity.getByTestId("lead-activity-submit").click();
  await expect(activity).toContainText("Le ofrecí dos PH en Villa Crespo");
  await expect(activity).toContainText("Llamada");
  // Logging activity restarts the inactivity clock: no longer "por vencer".
  await expect(card.getByTestId("lead-status")).toHaveCount(0);

  // Reminder: a preset fills the date (09:00 by default), then the note.
  await card.getByTestId("lead-field-reminder").click();
  await expect(card.getByTestId("reminder-note")).toHaveCount(0);
  await card.getByTestId("reminder-preset-tomorrow").click();
  await expect(card.getByTestId("reminder-preset-tomorrow")).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByTestId("reminder-date")).toHaveValue(localDateInput(new Date(Date.now() + 86_400_000)));
  await expect(card.getByTestId("reminder-time")).toHaveValue("09:00");
  await expect(card.getByTestId("reminder-note")).toBeFocused();
  await card.getByTestId("reminder-note").fill("Confirmar visita");
  await card.getByRole("button", { name: "Guardar recordatorio" }).click();
  await expect(card.getByTestId("lead-reminder")).toContainText("Confirmar visita");
  await expect(card.getByTestId("lead-reminder")).toContainText("Vence mañana");
  // The editor closed and the row reads the reminder back.
  await expect(card.getByTestId("reminder-date")).toHaveCount(0);

  const state = await withSql(
    (sql) => sql`SELECT owner_email, next_action_note FROM dashboard.lead_state WHERE contact_wa_id = ${F.atRisk.wa_id}`,
  );
  expect(state[0]).toMatchObject({ owner_email: ADMIN, next_action_note: "Confirmar visita" });
});

test("Logging a visit offers to move the lead to Visita", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto(`/conversations/${F.atRisk.wa_id}`);
  const card = page.getByTestId("lead-crm-card");
  await expect(card).toContainText("Nuevo");
  const activity = page.getByTestId("lead-activity");
  await activity.getByTestId("activity-kind-visit").click();
  await activity.getByTestId("lead-activity-body").fill("Vimos el 2 ambientes de Gurruchaga");
  await activity.getByTestId("lead-activity-submit").click();
  await expect(activity).toContainText("Vimos el 2 ambientes de Gurruchaga");
  const saved = page.locator("[data-sonner-toast]").filter({ hasText: "Guardado" });
  await saved.getByRole("button", { name: "Pasar a Visita" }).click();
  await expect(card.getByTestId("lead-field-stage")).toContainText("Visita");
  await expect.poll(() => lastAudit("lead_set_stage")).toMatchObject({
    contact_wa_id: F.atRisk.wa_id,
    from: "nuevo",
    to: "visita",
    ok: true,
  });
  // A note on a lead already at Visita offers nothing.
  await activity.getByTestId("activity-kind-note").click();
  await activity.getByTestId("lead-activity-body").fill("Sin novedades");
  await activity.getByTestId("lead-activity-submit").click();
  await expect(activity).toContainText("Sin novedades");
  await expect(page.locator("[data-sonner-toast]").getByRole("button", { name: /Pasar a/ })).toHaveCount(0);
});

test("Qualification card shows what the bot captured", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  const rows = await withSql(
    (sql) => sql`SELECT contact_wa_id FROM automation.escalations WHERE target_zone = 'Palermo' LIMIT 1`,
  );
  await page.goto(`/conversations/${rows[0]?.contact_wa_id}`);
  const qual = page.getByTestId("lead-qualification");
  await expect(qual.getByTestId("lead-qualification-summary")).toContainText("Busca 3 ambientes en Palermo");
  const chips = qual.getByTestId("lead-qualification-chips");
  await expect(chips).toContainText("Palermo");
  await expect(chips).toContainText("USD 150.000");
  // The price range is a detail: folded until "Ver todo".
  await expect(qual.getByText("USD 120k – 160k")).toBeHidden();
  await expect(qual.getByTestId("lead-qualification-more")).toContainText("Ver todo (");
  await qual.getByTestId("lead-qualification-more").click();
  await expect(qual.getByText("USD 120k – 160k")).toBeVisible();
  await expect(qual.getByTestId("lead-qualification-more")).toContainText("Ver menos");
  await expect(page.getByTestId("lead-crm-card")).toContainText("Calificado");
});

test("Asesor manages leads but cannot touch Settings or someone else's lead", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH, ASESOR);
  await expect(page.getByRole("link", { name: "Leads", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Configuración" })).toHaveCount(0);
  // The asesor's own leads have nothing overdue or about to expire.
  await expect(page.getByTestId("crm-alert-banner")).toHaveCount(0);

  await page.goto(`/conversations/${F.reserva.wa_id}`);
  await page.getByTestId("lead-field-stage").click();
  await expect(page.getByTestId("lead-stage-select")).toBeVisible();

  // A colleague's lead: no owner editor, and the row says why.
  await page.goto(`/conversations/${F.visita.wa_id}`);
  await expect(page.getByTestId("lead-field-owner")).toHaveCount(0);
  await expect(page.getByTestId("lead-owner-locked")).toHaveText("Solo un admin puede reasignar este lead.");

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
  await expect(page.locator('[data-testid^="lead-field-"]')).toHaveCount(0);

  const res = await page.request.post("/api/leads/set-stage", {
    data: { contactWaId: F.visita.wa_id, stage: "cerrado" },
  });
  expect(res.status()).toBe(403);
});

test("Registers a walk-in lead by hand and refuses a duplicate phone", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads");

  await page.getByTestId("new-lead").click();
  await page.locator("#new-lead-name").fill("Marta Iglesias");
  await page.locator("#new-lead-phone").fill("011 15 4444-7777");
  await expect(page.getByTestId("new-lead-phone-preview")).toContainText("+54 9 1144447777");
  await page.locator("#new-lead-source").selectOption("telefono");
  await page.locator("#new-lead-intent").selectOption("Alquileres");
  await page.locator("#new-lead-note").fill("Llamó por el PH de Caballito");
  await page.getByRole("button", { name: "Cargar lead" }).click();

  // Lands on the lead modal over the board, "Próximo paso" already open and
  // the lead assigned to whoever registered it.
  await page.waitForURL(/\/leads\/5491144447777\?edit=reminder$/);
  const modal = page.getByTestId("lead-detail-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId("lead-crm-card")).toContainText("Nuevo");
  await expect(modal.getByTestId("lead-intent")).toHaveText("Alquileres");
  await expect(modal.getByTestId("lead-owner")).toHaveText("Dev Admin");
  await expect(modal.getByTestId("reminder-preset-tomorrow")).toBeVisible();
  await expect(modal.getByTestId("lead-activity")).toContainText("Llamó por el PH de Caballito");
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);

  // The board behind the modal already shows the new card (no reload):
  // Nuevo column, origin chip, and the intent chosen on the form.
  const card = page.locator('[data-lead-card="5491144447777"]');
  await expect(page.locator('[data-board-column="nuevo"]')).toContainText("Marta Iglesias");
  await expect(card.getByTestId("lead-source")).toHaveText("Teléfono");
  await expect(card.getByTestId("lead-intent")).toHaveText("Alquileres");

  // Its page exists without a WhatsApp conversation.
  await page.goto("/conversations/5491144447777");
  await expect(page.getByTestId("no-conversation")).toContainText("Teléfono");
  await page.goto("/leads");

  await expect.poll(() => lastAudit("lead_create")).toMatchObject({ contact_wa_id: "5491144447777", ok: true });

  // Same person again (and a WhatsApp contact) → "already exists", no duplicate.
  await page.getByTestId("new-lead").click();
  await page.locator("#new-lead-name").fill("Marta I.");
  await page.locator("#new-lead-phone").fill("+54 9 11 4444 7777");
  await page.getByRole("button", { name: "Cargar lead" }).click();
  const alert = page.getByRole("dialog").getByRole("alert");
  await expect(alert).toContainText("Ese teléfono ya es un lead.");
  await expect(alert.getByRole("link", { name: "Abrir el existente" })).toHaveAttribute(
    "href",
    "/leads/5491144447777",
  );

  const res = await page.request.post("/api/leads/create", {
    data: { name: "Ramiro", phone: F.visita.wa_id, source: "otro" },
  });
  expect(res.status()).toBe(409);
  expect(await res.json()).toMatchObject({ error: "already_exists", contactWaId: F.visita.wa_id });
});

test("Seeded manual lead shows its origin and no conversation", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads?view=list");
  await expect(leadRows(page).filter({ hasText: F.manual.name })).toContainText("Visita a la oficina");

  await page.goto(`/conversations/${F.manual.wa_id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(F.manual.name);
  const panel = page.getByTestId("no-conversation");
  await expect(panel).toContainText("Todavía no escribió por WhatsApp");
  await expect(panel).toContainText("Ana Asesora");
  await expect(panel.getByRole("link")).toHaveAttribute("href", `https://wa.me/${F.manual.wa_id}`);
});

test("Board shows the budget the bot captured and totals it per column", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  const rows = await withSql(
    (sql) => sql`SELECT contact_wa_id FROM automation.escalations WHERE target_zone = 'Palermo' LIMIT 1`,
  );
  const waId = rows[0]?.contact_wa_id as string;
  await page.goto("/leads");
  const card = page.locator(`[data-lead-card="${waId}"]`);
  await expect(card.getByTestId("lead-budget")).toHaveText("USD 150.000");
  const column = page.locator('[data-board-column="calificado"]');
  await expect(column.locator(`[data-lead-card="${waId}"]`)).toHaveCount(1);
  await expect(column.locator("[data-column-budget]")).toHaveText("USD 150.000");
  // Leads from the bot say so; a range with no amount shows the range itself
  // (engine snapshot object → one line), never raw JSON.
  await expect(card.getByTestId("lead-source")).toHaveText("WhatsApp");
  const upcoming = page.locator(`[data-lead-card="${F.upcoming.wa_id}"]`);
  await expect(upcoming.getByTestId("lead-budget")).toHaveText("USD 90.000 – 110.000");

  await page.goto("/leads?view=list");
  await expect(page.locator(`a[href="/conversations/${waId}"]`).first()).toContainText("USD 150.000");
});

test("Activity tab lists the team's events and filters by kind", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads");
  await page.getByTestId("leads-view-tabs").getByRole("link", { name: "Actividad" }).click();
  await page.waitForURL(/view=activity/);

  const feed = page.getByTestId("team-activity");
  await expect(feed.locator("li")).toHaveCount(5);
  await expect(feed).toContainText("Coordinamos visita para el sábado");
  await expect(feed).toContainText(F.manual.name);

  await page.getByTestId("activity-kind-filter").selectOption("call");
  await page.waitForURL(/kind=call/);
  await expect(feed.locator("li")).toHaveCount(1);
  await expect(feed.locator("li").first()).toHaveAttribute("data-event-kind", "call");
  await feed.getByRole("link", { name: F.visita.name }).click();
  await page.waitForURL(new RegExp(`/conversations/${F.visita.wa_id}`));
});

test("Header search finds leads by name and by phone", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads");

  // "/" focuses the field from anywhere. The listener mounts on hydration,
  // which on CI can land after the first keypress: retry the pair.
  const search = page.getByTestId("global-search");
  await expect(async () => {
    await page.keyboard.press("/");
    await expect(search).toBeFocused({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  await search.fill("agustina");
  await search.press("Enter");
  await page.waitForURL(/\/buscar\?q=agustina/);
  await expect(page.getByTestId("search-meta")).toContainText("1 resultado");
  await expect(page.getByRole("link", { name: `Abrir ${F.reserva.name}` })).toBeVisible();

  // By phone, including a lead registered by hand and a lost one.
  await page.goto("/buscar?q=55504008");
  await expect(page.getByRole("link", { name: `Abrir ${F.manual.name}` })).toBeVisible();
  await page.goto("/buscar?q=55504004");
  await expect(page.getByRole("link", { name: `Abrir ${F.lost.name}` })).toContainText("Perdido");

  await page.goto("/buscar?q=zzzz-nadie");
  await expect(page.getByText("No encontramos nada con “zzzz-nadie”")).toBeVisible();
});

test("Resumen tab shows the 7-day indicators and the breakdowns", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads");
  await page.getByTestId("leads-view-tabs").getByRole("link", { name: "Resumen" }).click();
  await page.waitForURL(/view=summary/);
  await expect(page.locator("[data-board-column]")).toHaveCount(0);
  await expect(page.locator("[data-board-bleed]")).toHaveCount(1);

  // Fixture-stable numbers (lead_state and manual_leads are truncated per test).
  const dueSoon = page.getByTestId("summary-kpi-dueSoon");
  await expect(dueSoon).toContainText("1");
  await expect(dueSoon).toContainText("1 vencido");
  await expect(page.getByTestId("summary-stages").locator("[data-summary-stage]")).toHaveCount(7);
  await expect(page.getByTestId("summary-stages").locator(".recharts-surface")).toBeVisible();
  await expect(page.getByTestId("summary-priority").locator('[data-row="alta"] [data-count]')).toHaveText("1");
  await expect(
    page.getByTestId("summary-workload").locator("li", { hasText: "Ana Asesora" }).locator("[data-count]"),
  ).toHaveText("3");
  await expect(page.getByTestId("summary-sources").locator('[data-row="visita"] [data-count]')).toHaveText("1");

  // Closing a lead today shows up under "Cerrados".
  const res = await page.request.post("/api/leads/set-stage", {
    data: { contactWaId: F.contacted.wa_id, stage: "cerrado" },
  });
  expect(res.status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId("summary-kpi-closed")).toContainText("1");
});

test("Priority from the board ⋯ menu, on the list, and as a filter", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads?view=board");
  // Seeded: visita = Alta, and prioritized cards come first in their column.
  await expect(page.locator(`[data-lead-card="${F.visita.wa_id}"]`).getByTestId("lead-priority")).toHaveText("Alta");

  const card = page.locator(`[data-lead-card="${F.atRisk.wa_id}"]`);
  await card.getByTestId("lead-menu").click();
  await page.getByRole("menuitem", { name: "Alta", exact: true }).click();
  await expect(card.getByTestId("lead-priority")).toHaveText("Alta");
  await expect
    .poll(() =>
      withSql(async (sql) => {
        const rows = await sql`SELECT priority FROM dashboard.lead_state WHERE contact_wa_id = ${F.atRisk.wa_id}`;
        return rows[0]?.priority ?? null;
      }),
    )
    .toBe("alta");
  await expect.poll(() => lastAudit("lead_set_priority")).toMatchObject({
    contact_wa_id: F.atRisk.wa_id,
    to: "alta",
    ok: true,
  });

  await page.goto("/leads?view=list&priority=alta");
  await expect(leadRows(page)).toHaveCount(2);
  await expect(leadRows(page).first().getByTestId("lead-priority")).toHaveText("Alta");
  await expect(page.locator('button[data-priority="alta"]')).toHaveAttribute("aria-pressed", "true");
});

test("Priority from the lead card is logged in its history", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto(`/conversations/${F.reserva.wa_id}`);
  const card = page.getByTestId("lead-crm-card");
  await expect(card.getByTestId("lead-priority")).toHaveText("Media");
  await card.getByTestId("lead-field-priority").click();
  await card.getByTestId("lead-priority-select").selectOption("baja");
  await expect(card.getByTestId("lead-priority")).toHaveText("Baja");
  await expect(card.getByTestId("lead-priority-select")).toHaveCount(0);
  const activity = page.getByTestId("lead-activity");
  await expect(activity).toContainText("Prioridad");
  await expect(activity).toContainText("→ Baja");
});

test("Guía documents the stages and rules; the viewer can read it but not prioritize", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH, VIEWER);
  await page.goto("/leads");
  await page.getByTestId("leads-view-tabs").getByRole("link", { name: "Guía" }).click();
  await page.waitForURL(/view=guide/);
  const guide = page.getByTestId("leads-guide");
  await expect(guide.locator("[data-guide-stage]")).toHaveCount(7);
  await expect(guide.locator('[data-guide-stage="visita"]')).toContainText("La marca un asesor");
  await expect(guide).toContainText("30 días");
  await expect(guide).toContainText("Visita a la oficina");

  await page.goto(`/conversations/${F.reserva.wa_id}`);
  await expect(page.getByTestId("lead-crm-card").getByTestId("lead-priority")).toHaveText("Media");
  await expect(page.getByTestId("lead-priority-select")).toHaveCount(0);
  const res = await page.request.post("/api/leads/set-priority", {
    data: { contactWaId: F.reserva.wa_id, priority: "alta" },
  });
  expect(res.status()).toBe(403);
});

test("Board card opens the lead modal; edits refresh the board; Esc and navigating away close it", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads?view=board");
  const card = page.locator(`[data-lead-card="${F.reserva.wa_id}"]`);
  await card.getByTestId("lead-open").click();
  await page.waitForURL(new RegExp(`/leads/${F.reserva.wa_id}$`));
  const modal = page.getByTestId("lead-detail-modal");
  await expect(modal).toBeVisible();
  await expect(modal).toContainText(F.reserva.name);
  await expect(modal.getByTestId("lead-crm-card")).toContainText("Reserva");
  await expect(modal.getByTestId("lead-activity")).toBeVisible();
  // The board is still mounted behind the modal.
  await expect(page.locator("[data-board-column]")).toHaveCount(5);

  // An edit inside the modal reaches the card behind it (router.refresh()).
  await modal.getByTestId("lead-field-priority").click();
  await modal.getByTestId("lead-priority-select").selectOption("baja");
  await expect(modal.getByTestId("lead-priority").first()).toHaveText("Baja");
  await expect(card.getByTestId("lead-priority")).toHaveText("Baja");

  await page.keyboard.press("Escape");
  await page.waitForURL(/\/leads\?view=board$/);
  await expect(modal).toHaveCount(0);

  // A soft navigation away (the modal's own "Ver conversación") closes it:
  // the catch-all slot renders nothing on the new page.
  await card.getByTestId("lead-open").click();
  await expect(modal).toBeVisible();
  await modal.getByTestId("lead-open-conversation").click();
  await page.waitForURL(new RegExp(`/conversations/${F.reserva.wa_id}`));
  await expect(modal).toHaveCount(0);
  await expect(page.getByTestId("lead-crm-card")).toBeVisible();

  // A hard load of the modal URL is the full conversation page.
  await page.goto(`/leads/${F.reserva.wa_id}`);
  await page.waitForURL(new RegExp(`/conversations/${F.reserva.wa_id}`));
});

test("Budget typed by hand wins over the bot's figure and can be cleared", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads?view=board");
  const card = page.locator(`[data-lead-card="${F.reserva.wa_id}"]`);
  await expect(card.getByTestId("lead-budget")).toHaveText("USD 90.000"); // seeded manual budget
  await card.getByTestId("lead-open").click();
  const modal = page.getByTestId("lead-detail-modal");
  await expect(modal.getByTestId("lead-budget-value")).toHaveText("USD 90.000");

  await modal.getByTestId("lead-field-budget").click();
  await modal.getByTestId("lead-budget-amount").fill("120000");
  await modal.getByTestId("lead-budget-currency").selectOption("ARS");
  await modal.getByTestId("lead-budget-save").click();
  await expect(modal.getByTestId("lead-budget-value")).toHaveText("ARS 120.000", { timeout: 15_000 });
  await expect(card.getByTestId("lead-budget")).toHaveText("ARS 120.000");
  await expect(modal.getByTestId("lead-activity")).toContainText("→ ARS 120.000");
  await expect.poll(() => lastAudit("lead_set_budget")).toMatchObject({
    contact_wa_id: F.reserva.wa_id,
    from: { amount: 90000, currency: "USD" },
    to: { amount: 120000, currency: "ARS" },
    ok: true,
  });

  await modal.getByTestId("lead-field-budget").click();
  await modal.getByTestId("lead-budget-clear").click();
  await expect(modal.getByTestId("lead-budget-section")).toContainText("Sin presupuesto", { timeout: 15_000 });
  await expect(card.getByTestId("lead-budget")).toHaveCount(0);
  await page.keyboard.press("Escape");

  // On a lead the bot qualified, clearing the manual figure brings the bot's back.
  const rows = await withSql(
    (sql) => sql`SELECT contact_wa_id FROM automation.escalations WHERE target_zone = 'Palermo' LIMIT 1`,
  );
  const botCard = page.locator(`[data-lead-card="${rows[0]?.contact_wa_id}"]`);
  await expect(botCard.getByTestId("lead-budget")).toHaveText("USD 150.000");
  await botCard.getByTestId("lead-open").click();
  await expect(modal.getByTestId("lead-budget-section")).toContainText("Captado por el bot");
  await modal.getByTestId("lead-field-budget").click();
  await modal.getByTestId("lead-budget-amount").fill("180000");
  await modal.getByTestId("lead-budget-save").click();
  await expect(botCard.getByTestId("lead-budget")).toHaveText("USD 180.000", { timeout: 15_000 });
  await modal.getByTestId("lead-field-budget").click();
  await modal.getByTestId("lead-budget-clear").click();
  await expect(botCard.getByTestId("lead-budget")).toHaveText("USD 150.000", { timeout: 15_000 });
});

test("Intent shows on cards and filters the board; one click clears every filter", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads?view=board");
  await expect(page.locator(`[data-lead-card="${F.visita.wa_id}"]`).getByTestId("lead-intent")).toHaveText("Ventas");
  await expect(page.locator(`[data-lead-card="${F.atRisk.wa_id}"]`).getByTestId("lead-intent")).toHaveText("Alquileres");
  // A lead registered by hand never wrote: no intent chip.
  await expect(page.locator(`[data-lead-card="${F.manual.wa_id}"]`).getByTestId("lead-intent")).toHaveCount(0);

  await page.getByTestId("leads-intent-filter").selectOption("Alquileres");
  await page.waitForURL(/intent=Alquileres/);
  await expect(page.locator(`[data-lead-card="${F.atRisk.wa_id}"]`)).toBeVisible();
  await expect(page.locator(`[data-lead-card="${F.visita.wa_id}"]`)).toHaveCount(0);
  // The filter survives the switch to the list.
  await page.getByTestId("leads-view-tabs").getByRole("link", { name: "Lista" }).click();
  await page.waitForURL(/view=list.*intent=Alquileres|intent=Alquileres.*view=list/);
  await expect(page.getByTestId("leads-intent-filter")).toHaveValue("Alquileres");
  await expect(leadRows(page).filter({ hasText: F.atRisk.name })).toHaveCount(1);
  await expect(leadRows(page).filter({ hasText: F.visita.name })).toHaveCount(0);

  await page.goto("/leads?view=list&priority=alta&intent=Ventas&q=ram");
  const clear = page.getByTestId("leads-clear-filters");
  await expect(clear).toContainText("3");
  await clear.click();
  await page.waitForURL(/\/leads\?view=list$/);
  await expect(clear).toHaveCount(0);
  await expect(page.locator("#leads-search")).toHaveValue("");
});

test("Viewer opens the lead modal read-only and cannot set a budget", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH, VIEWER);
  await page.goto("/leads?view=board");
  await page.locator(`[data-lead-card="${F.reserva.wa_id}"]`).getByTestId("lead-open").click();
  const modal = page.getByTestId("lead-detail-modal");
  await expect(modal.getByTestId("lead-budget-value")).toHaveText("USD 90.000");
  await expect(modal.getByTestId("lead-budget-save")).toHaveCount(0);
  await expect(modal.getByTestId("lead-priority-select")).toHaveCount(0);
  await expect(modal.locator('[data-testid^="lead-field-"]')).toHaveCount(0);
  const res = await page.request.post("/api/leads/set-budget", {
    data: { contactWaId: F.reserva.wa_id, amount: 1000, currency: "USD" },
  });
  expect(res.status()).toBe(403);
});

test("Inline editing: keyboard, one row at a time, click outside, and losing a lead with a motive", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto(`/conversations/${F.reserva.wa_id}`);
  const card = page.getByTestId("lead-crm-card");

  // Enter opens, Esc closes and the focus returns to the value.
  const priorityRow = card.getByTestId("lead-field-priority");
  await priorityRow.focus();
  await page.keyboard.press("Enter");
  await expect(card.getByTestId("lead-priority-select")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(card.getByTestId("lead-priority-select")).toHaveCount(0);
  await expect(priorityRow).toBeFocused();

  // Only one row edits at a time.
  await priorityRow.click();
  await expect(card.getByTestId("lead-priority-select")).toBeVisible();
  await card.getByTestId("lead-field-budget").click();
  await expect(card.getByTestId("lead-priority-select")).toHaveCount(0);
  await expect(card.getByTestId("lead-budget-amount")).toBeVisible();

  // A click outside with a valid change commits; without one it just closes.
  await card.getByTestId("lead-budget-amount").fill("95000");
  await page.getByRole("heading", { level: 1 }).click();
  await expect(card.getByTestId("lead-budget-value")).toHaveText("USD 95.000", { timeout: 15_000 });
  await expect.poll(() => lastAudit("lead_set_budget")).toMatchObject({ to: { amount: 95000, currency: "USD" }, ok: true });
  await card.getByTestId("lead-field-budget").click();
  await page.getByRole("heading", { level: 1 }).click();
  await expect(card.getByTestId("lead-budget-amount")).toHaveCount(0);
  await expect(card.getByTestId("lead-budget-value")).toHaveText("USD 95.000");

  // Losing a lead asks for the motive first, then ✓ saves it.
  await card.getByTestId("lead-field-stage").click();
  await card.getByTestId("lead-stage-select").selectOption("perdido");
  await expect(card.locator(`#lost-reason-${F.reserva.wa_id}`)).toBeVisible();
  await card.locator(`#lost-reason-${F.reserva.wa_id}`).selectOption("No responde");
  await card.getByTestId("lead-field-confirm").click();
  await expect(card).toContainText("Perdido");
  await expect(card.getByTestId("lead-status")).toContainText("No responde");
  await expect.poll(() => lastAudit("lead_set_stage")).toMatchObject({ to: "perdido", ok: true });
});

test("Board: attention strip first, Hoy filter, rails, column subtitles", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads?view=board");

  // The overdue reminder is the first card of its column even without priority.
  const nuevo = page.locator('[data-board-column="nuevo"]');
  await expect(nuevo.locator("[data-lead-card]").first()).toHaveAttribute("data-lead-card", F.overdue.wa_id);
  const strip = page.locator(`[data-lead-card="${F.overdue.wa_id}"]`).getByTestId("lead-attention");
  await expect(strip).toHaveAttribute("data-attention", "overdue");
  await expect(strip).toContainText("Vencido");
  await expect(strip).toContainText("Llamar para coordinar la visita");
  await expect(page.locator(`[data-lead-card="${F.atRisk.wa_id}"]`).getByTestId("lead-attention")).toHaveAttribute("data-attention", "at_risk");
  await expect(page.locator(`[data-lead-card="${F.contacted.wa_id}"]`).getByTestId("lead-attention")).toHaveCount(0);

  // Who moves the stage: subtitle, lock on manual-only columns, bot glyph on auto chips.
  await expect(nuevo.locator("[data-column-mover]")).toHaveText("La mueve el bot");
  await expect(page.locator('[data-board-column="visita"] [data-column-lock]')).toHaveCount(1);
  await expect(page.locator('[data-board-column="nuevo"] [data-column-lock]')).toHaveCount(0);

  // Terminal columns are rails; opening one is URL state.
  await expect(page.locator("[data-board-rail]")).toHaveCount(2);
  await page.locator('[data-board-rail="perdido"]').click();
  await page.waitForURL(/open=perdido/);
  await expect(page.locator('[data-board-column="perdido"]')).toContainText(F.lost.name);
  await expect(page.locator("[data-board-rail]")).toHaveCount(1);

  // Hoy: overdue + at-risk (admin sees everyone's) + unassigned in Nuevo/Calificado.
  // Chip groups carry their kicker; urgency reads Vencidos → Se pierden → Sin responsable.
  await expect(page.locator('[data-filter-group="mine"]')).toContainText("Para mí");
  await expect(page.locator('[data-filter-group="urgency"]')).toContainText("Urgencia");
  await expect(page.locator('[data-filter-group="priority"]')).toContainText("Prioridad");
  await expect(page.locator('[data-filter-group="urgency"] button')).toHaveText([
    "Vencidos",
    "Se pierden pronto",
    "Sin responsable",
  ]);
  const today = page.getByTestId("filter-today");
  const n = Number((await today.textContent())?.replace(/\D/g, ""));
  expect(n).toBeGreaterThanOrEqual(2);
  await today.click();
  await page.waitForURL(/filter=today/);
  await expect(page.locator(`[data-lead-card="${F.overdue.wa_id}"]`)).toBeVisible();
  await expect(page.locator(`[data-lead-card="${F.atRisk.wa_id}"]`)).toBeVisible();
  await expect(page.locator(`[data-lead-card="${F.visita.wa_id}"]`)).toHaveCount(0);
  await expect(page.locator("[data-lead-card]")).toHaveCount(n);
});

test("Board: losing a lead asks for the motive; stage moves can be undone", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads?view=board");
  const card = page.locator(`[data-lead-card="${F.contacted.wa_id}"]`);

  // ⋯ → Perdido lands the card in the (now open) column and asks why.
  await card.getByTestId("lead-menu").click();
  await page.getByRole("menuitem", { name: "Perdido", exact: true }).click();
  const panel = page.getByTestId("lost-reason-panel");
  await expect(panel).toBeVisible();
  await expect(page.locator('[data-board-column="perdido"]')).toContainText(F.contacted.name);
  await panel.getByRole("button", { name: "Cancelar" }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator('[data-board-column="contactado"]')).toContainText(F.contacted.name);
  await expect
    .poll(() =>
      withSql(async (sql) => {
        const rows = await sql`SELECT stage FROM dashboard.lead_state WHERE contact_wa_id = ${F.contacted.wa_id}`;
        return rows[0]?.stage ?? null;
      }),
    )
    .toBeNull();

  await card.getByTestId("lead-menu").click();
  await page.getByRole("menuitem", { name: "Perdido", exact: true }).click();
  await page.locator("#lost-reason-board").selectOption("No responde");
  await page.getByTestId("lost-reason-confirm").click();
  await expect(page.getByTestId("lost-reason-panel")).toHaveCount(0);
  await expect.poll(() => lastAudit("lead_set_stage")).toMatchObject({
    contact_wa_id: F.contacted.wa_id,
    to: "perdido",
    ok: true,
  });
  await expect(page.locator(`[data-lead-card="${F.contacted.wa_id}"]`).getByTestId("lead-attention")).toContainText("No responde");

  // Move Reserva → Visita, then Deshacer from the toast.
  const reserva = page.locator(`[data-lead-card="${F.reserva.wa_id}"]`);
  await reserva.getByTestId("lead-menu").click();
  await page.getByRole("menuitem", { name: "Visita", exact: true }).click();
  await expect(page.locator('[data-board-column="visita"]')).toContainText(F.reserva.name);
  // Scope to the toast of this move (the Perdido toast above may still be visible).
  await page.locator("[data-sonner-toast]", { hasText: F.reserva.name }).getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator('[data-board-column="reserva"]')).toContainText(F.reserva.name);
  await expect
    .poll(() =>
      withSql(async (sql) => {
        const rows = await sql`SELECT stage FROM dashboard.lead_state WHERE contact_wa_id = ${F.reserva.wa_id}`;
        return rows[0]?.stage ?? null;
      }),
    )
    .toBe("reserva");
});

test("Board remembers the last filters until they are cleared", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads?filter=overdue&priority=alta");
  await expect(page.getByTestId("leads-clear-filters")).toBeVisible();

  // Back to bare /leads: the last filter set comes back (URL updated).
  await page.goto("/leads");
  await page.waitForURL(/\/leads\?filter=overdue&priority=alta$/);
  await expect(page.getByTestId("leads-clear-filters")).toContainText("2");

  // Search text and page are never remembered; filterless views don't touch it.
  await page.goto("/leads?view=summary");
  await page.goto("/leads");
  await page.waitForURL(/\/leads\?filter=overdue&priority=alta$/);

  // Limpiar filtros forgets them: bare /leads stays bare.
  await page.getByTestId("leads-clear-filters").click();
  await page.waitForURL(/\/leads$/);
  await page.goto("/leads");
  await expect(page.getByTestId("leads-clear-filters")).toHaveCount(0);
  await expect(page).toHaveURL(/\/leads$/);
});

test("Board: nothing matches the filters → one empty state with a clear link", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await page.goto("/leads?view=board&q=zzzz-nadie");
  await expect(page.locator("[data-board-column]")).toHaveCount(0);
  await expect(page.getByText("Ningún lead coincide con estos filtros.")).toBeVisible();
  // The empty-state link is a Base UI Button rendered as <a> (role=button),
  // so it is addressed by testid, not by role.
  await page.getByTestId("board-clear-filters").click();
  await page.waitForURL(/\/leads$/);
  await expect(page.locator("[data-board-column]")).toHaveCount(5);
});

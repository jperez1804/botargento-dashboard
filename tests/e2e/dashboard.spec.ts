import { expect, test } from "@playwright/test";
import path from "node:path";
import { loginAsDevViaLog, resetAuthState } from "./helpers";

const LOG_PATH = path.resolve(".playwright-dev-server.log");

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await resetAuthState();
  await loginAsDevViaLog(page, LOG_PATH);
});

test("Overview renders KPI cards + both charts + follow-up preview", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".recharts-surface");
  // Editorial masthead from the Reserved Operations redesign.
  await expect(
    page.getByRole("heading", { name: "Operaciones del período" }),
  ).toBeVisible();

  // 4 KPI cards
  const kpiLabels = await page
    .locator('[data-slot="card-content"] .uppercase')
    .allTextContents();
  expect(kpiLabels).toContain("Mensajes entrantes");
  expect(kpiLabels).toContain("Mensajes salientes");
  expect(kpiLabels).toContain("Contactos únicos");
  expect(kpiLabels).toContain("Tasa de derivación");
  expect(kpiLabels).toContain("Intención líder");
  expect(kpiLabels).toContain("Resueltas por el bot");

  // Three charts + heatmap present: daily volume + two intent views + heatmap.
  // Scope to card titles so the assertions don't accidentally match the
  // attribution scope note, which mentions "Contactos por intención" +
  // "Intención líder" inside its body copy.
  const cardTitles = page.locator('[data-slot="card-title"]');
  await expect(cardTitles.filter({ hasText: "Volumen de mensajes" })).toBeVisible();
  await expect(cardTitles.filter({ hasText: "Contactos por intención" })).toBeVisible();
  await expect(cardTitles.filter({ hasText: "Volumen por intención" })).toBeVisible();
  await expect(page.getByText(/Demanda por hora/)).toBeVisible();

  // Follow-up preview section
  await expect(page.getByRole("heading", { name: "Contactos prioritarios" })).toBeVisible();
});

test("Conversations list filters and paginates", async ({ page }) => {
  await page.goto("/conversations");
  await page.waitForSelector("table tbody tr");
  const initial = await page.locator("tbody tr").count();
  expect(initial).toBeGreaterThan(0);

  await page.fill("#contact-search", "Lucía");
  await page.waitForFunction(() => new URL(location.href).searchParams.get("q") === "Lucía");
  await page.waitForLoadState("networkidle");
  expect(await page.locator("tbody tr").count()).toBe(1);
});

test("Handoffs page excludes error rows", async ({ page }) => {
  await page.goto("/handoffs");
  await page.waitForSelector("table tbody tr");
  const tableHtml = (await page.locator("tbody").innerText()).toLowerCase();
  expect(tableHtml).not.toContain("etimedout");
  expect(tableHtml).not.toContain("error");
  expect(await page.locator("tbody tr").count()).toBe(12);
});

test("Follow-up page renders all three priority badges", async ({ page }) => {
  await page.goto("/follow-up");
  await page.waitForSelector("ul li");
  const badges = await page.locator("ul li span:first-child").allTextContents();
  expect(badges).toContain("Alta");
  expect(badges).toContain("Media");
  expect(badges).toContain("Baja");
});

test("Touch-mode toggle on Contactos por intención updates URL state", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".recharts-surface");

  // Default = last; URL has no `touch` param.
  expect(new URL(page.url()).searchParams.get("touch")).toBeNull();
  await expect(page.getByText(/cuenta al contacto donde terminó/i)).toBeVisible();

  // Advanced modes are gated behind a disclosure; expand it before clicking.
  await page.getByRole("button", { name: /análisis avanzado/i }).click();
  await page.getByRole("radio", { name: "Interés inicial" }).click();
  await page.waitForFunction(() => new URL(location.href).searchParams.get("touch") === "first");
  await expect(page.getByText(/cuenta al contacto por lo primero/i)).toBeVisible();
});

test("CSV export downloads a correctly-formatted file", async ({ page }) => {
  await page.goto("/conversations");
  await page.waitForSelector("table tbody tr");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Exportar CSV/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^conversations-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/);

  const stream = await download.createReadStream();
  let content = "";
  for await (const chunk of stream) {
    content += chunk.toString("utf8");
  }
  // Strip BOM for header check
  const firstLine = content.replace(/^﻿/, "").split(/\r?\n/)[0];
  expect(firstLine).toBe(
    "contact_wa_id,display_name,first_seen,last_seen,message_count,last_intent,handoff_count",
  );
});

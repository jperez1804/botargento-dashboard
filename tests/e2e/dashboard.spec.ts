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
  await expect(page.getByRole("heading", { name: "Panel" })).toBeVisible();

  // 4 KPI cards
  const kpiLabels = await page
    .locator('[data-slot="card-content"] .uppercase')
    .allTextContents();
  expect(kpiLabels).toContain("Mensajes entrantes");
  expect(kpiLabels).toContain("Mensajes salientes");
  expect(kpiLabels).toContain("Contactos únicos");
  expect(kpiLabels).toContain("Tasa de derivación");

  // Both charts present
  await expect(page.getByText("Volumen de mensajes")).toBeVisible();
  await expect(page.getByText("Mensajes por intención")).toBeVisible();

  // Follow-up preview section
  await expect(page.getByRole("heading", { name: "Seguimiento prioritario" })).toBeVisible();
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

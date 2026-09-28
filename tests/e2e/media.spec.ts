// Media in the conversation thread, end to end against the seeded DB
// (scripts/seed-dev.ts gives "Lucía" a stored 1x1 PNG, a photo whose asset is
// gone, and a document that was too large to keep).

import { expect, request, test } from "@playwright/test";
import path from "node:path";
import { loginAsDevViaLog, resetAuthState } from "./helpers";

const LOG_PATH = path.resolve(".playwright-dev-server.log");
const WA = "5491155501004";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await resetAuthState();
  await loginAsDevViaLog(page, LOG_PATH);
});

test("the thread shows a stored photo, and explains the two that have no bytes", async ({ page }) => {
  await page.goto(`/conversations/${WA}`);

  // The stored photo renders as an <img> pointing at the bytes route. The id is
  // a BIGSERIAL, so match the prefix and read the real src back.
  const img = page.locator('img[src^="/api/media/"]').first();
  await expect(img).toBeVisible();
  const src = await img.getAttribute("src");
  expect(src).toMatch(/^\/api\/media\/\d+$/);

  // Same session as the page: the bytes come back as the PNG that was seeded.
  const res = await page.request.get(src!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
  expect(res.headers()["cache-control"]).toBe("private, no-store");
  const body = await res.body();
  expect(body.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  // No asset at all -> retention swept it, or it predates capture.
  await expect(page.getByText("Foto — ya no disponible")).toBeVisible();
  // A row without bytes explains itself.
  await expect(page.getByText("Archivo muy grande")).toBeVisible();
});

test("without a session the bytes route never answers with the file", async () => {
  // A fresh context has no cookie. The proxy guard redirects to /login before
  // the handler runs; following the redirect must never land on image bytes.
  const anon = await request.newContext({ baseURL: "http://localhost:3000", maxRedirects: 0 });
  const res = await anon.get("/api/media/1");
  expect([302, 307, 401]).toContain(res.status());
  expect(res.headers()["content-type"] ?? "").not.toMatch(/^image\//);
  await anon.dispose();
});

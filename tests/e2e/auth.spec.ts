import { expect, test } from "@playwright/test";
import path from "node:path";
import { resetAuthState, loginAsDevViaLog } from "./helpers";

const LOG_PATH = path.resolve(".playwright-dev-server.log");

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await resetAuthState();
});

test("unauthenticated /  → redirected to /login", async ({ page }) => {
  const res = await page.goto("/");
  // The proxy redirects with 307; Playwright auto-follows, end at /login
  expect(page.url()).toContain("/login");
  expect(res?.status()).toBeLessThan(400);
});

test("login + verify happy path", async ({ page }) => {
  await loginAsDevViaLog(page, LOG_PATH);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Operaciones del período" })).toBeVisible();
});

test("non-allowlisted email never gets a session", async ({ page, request }) => {
  // Hit the signin endpoint directly — the form action surfaces Auth.js's
  // AccessDenied as a server error (a UX choice we'd polish in a later pass).
  // The protocol-level behavior we care about is what real attackers see, so
  // we test that.
  const csrfRes = await request.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();
  const post = await request.post("/api/auth/signin/resend", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: `email=stranger@example.com&csrfToken=${csrfToken}&callbackUrl=${encodeURIComponent("/")}`,
    maxRedirects: 0,
  });
  // Auth.js's email provider always 302s; the silence is at the email layer
  expect(post.status()).toBe(302);

  // No session cookie was set; visiting / still bounces
  await page.goto("/");
  expect(page.url()).toContain("/login");
});

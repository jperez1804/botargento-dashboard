import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import postgres from "postgres";
import { resetAuthState, loginAsDevViaLog } from "./helpers";

const LOG_PATH = path.resolve(".playwright-dev-server.log");

test.describe.configure({ mode: "serial" });

async function withSql<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const url = process.env.TENANT_DB_URL;
  if (!url) throw new Error("TENANT_DB_URL is required for auth.spec");
  const sql = postgres(url, { max: 1, idle_timeout: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** Magic-link tokens issued for an address (hashed rows — we only count). */
function countMagicLinkTokens(email: string): Promise<number> {
  return withSql(async (sql) => {
    const rows = await sql`SELECT COUNT(*)::int AS n FROM dashboard.magic_link_tokens WHERE email = ${email}`;
    return Number(rows[0]?.n ?? 0);
  });
}

function lastLoginDeniedReason(email: string): Promise<string | null> {
  return withSql(async (sql) => {
    const rows = await sql`
      SELECT metadata->>'reason' AS reason FROM dashboard.audit_log
      WHERE action = 'login_denied' AND email = ${email}
      ORDER BY id DESC LIMIT 1
    `;
    return (rows[0]?.reason as string | undefined) ?? null;
  });
}

/** The dev server prints magic links instead of emailing them. */
async function latestMagicLink(email: string): Promise<string> {
  const emailParam = `email=${encodeURIComponent(email)}`;
  for (let i = 0; i < 30; i++) {
    const log = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, "utf8") : "";
    const links = [
      ...log.matchAll(/http:\/\/localhost:3000\/api\/auth\/callback\/resend\?[^\s]+/g),
    ].filter((m) => m[0].includes(emailParam));
    const last = links.at(-1)?.[0];
    if (last) return last;
    await wait(200);
  }
  throw new Error(`no magic link for ${email} in the dev server log`);
}

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
  // Protocol level, straight at the Auth.js endpoint (bypassing the form):
  // the signIn callback answers with a redirect back to the login error —
  // not AccessDenied — and no link is issued.
  const csrfRes = await request.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();
  const post = await request.post("/api/auth/signin/resend", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: `email=stranger@example.com&csrfToken=${csrfToken}&callbackUrl=${encodeURIComponent("/")}`,
    maxRedirects: 0,
  });
  expect(post.status()).toBe(302);
  expect(post.headers()["location"]).toContain("/login?error=not_allowed");
  expect(await countMagicLinkTokens("stranger@example.com")).toBe(0);

  // No session cookie was set; visiting / still bounces
  await page.goto("/");
  expect(page.url()).toContain("/login");
});

test("login form: a non-allowlisted email gets a readable error, never a 500", async ({ page }) => {
  // One of the two real typos from plec (2026-09-20).
  const serverErrors: number[] = [];
  page.on("response", (res) => {
    if (res.status() >= 500) serverErrors.push(res.status());
  });

  await page.goto("/login");
  await page.fill('input[name="email"]', "plec.arq@gmail.con");
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/login\?error=not_allowed/);
  await expect(page.locator("#login-error")).toHaveText(
    "Ese email no tiene acceso a este panel. Revisá que esté bien escrito.",
  );
  // The typed address comes back so the typo can be fixed in place.
  await expect(page.locator('input[name="email"]')).toHaveValue("plec.arq@gmail.con");
  expect(serverErrors).toEqual([]);
  expect(await countMagicLinkTokens("plec.arq@gmail.con")).toBe(0);
  expect(await lastLoginDeniedReason("plec.arq@gmail.con")).toBe("not_in_allowlist");
});

test("deep link: the error keeps the destination, and the fixed email lands there", async ({ page }) => {
  // Both production cases came in this way: /handoffs → /login?callbackUrl=…
  await page.goto("/handoffs");
  await page.waitForURL(/\/login\?callbackUrl=/);

  await page.fill('input[name="email"]', "etaramburelli@gamil.com");
  await page.click('button[type="submit"]');
  await page.waitForURL(/error=not_allowed/);
  expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe("/handoffs");
  await expect(page.locator("#login-error")).toBeVisible();

  // Fix the "typo" (use the allowlisted dev account) and follow the link.
  await page.fill('input[name="email"]', "dev@botargento.com.ar");
  await page.click('button[type="submit"]');
  await page.waitForURL(/(login\?sent|verify-request)/);
  const link = await latestMagicLink("dev@botargento.com.ar");
  expect(new URL(link).searchParams.get("callbackUrl")).toContain("/handoffs");
  await page.goto(link);
  await page.waitForURL(/\/handoffs$/);
});

test("login form: the email is normalized before the allowlist check", async ({ page }) => {
  await page.goto("/login");
  // Mixed case is kept by the input; the server action lowercases + trims.
  await page.fill('input[name="email"]', "DEV@BotArgento.com.ar");
  await page.click('button[type="submit"]');
  await page.waitForURL(/(login\?sent|verify-request)/);
  await expect(page.getByText("Te enviamos un link a tu correo.")).toBeVisible();
  expect(await countMagicLinkTokens("dev@botargento.com.ar")).toBeGreaterThan(0);
});

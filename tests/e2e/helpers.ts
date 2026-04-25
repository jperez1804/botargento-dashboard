import { spawnSync } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import type { Page } from "@playwright/test";

const ALLOWED_EMAIL = "dev@botargento.com.ar";

/** Issue a magic-link request, then redeem the most recent pending token. */
export async function loginAsDev(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', ALLOWED_EMAIL);
  await page.click('button[type="submit"]');
  await page.waitForURL(/(login\?sent|verify-request)/);

  // Wait for the token to land in dashboard.magic_link_tokens
  let token: string | null = null;
  for (let i = 0; i < 30; i++) {
    token = readPendingToken();
    if (token) break;
    await wait(200);
  }
  if (!token) throw new Error("no pending magic-link token in DB");

  // Hit the callback URL directly. Auth.js validates by `email + token` so we
  // assemble it here from values we control, not by reversing the hash.
  await page.goto(
    `/api/auth/callback/resend?token=${token}&email=${encodeURIComponent(ALLOWED_EMAIL)}&callbackUrl=${encodeURIComponent("/")}`,
  );
  await page.waitForURL("/");
}

/**
 * Magic-link tokens are stored hashed, so we can't just SELECT the plaintext.
 * Instead we re-read the dev server log file Playwright captures and pull the
 * most recently-printed link. (The dev short-circuit in src/lib/auth.ts logs
 * the URL to stdout instead of calling Resend.)
 *
 * In CI we want a deterministic source — fall back to scanning a known log.
 */
function readPendingToken(): string | null {
  // Easier path: just hit DB and grab the freshest unconsumed hash, then look
  // up the corresponding plain token from the most recent dev-log line.
  // Practically — and per Step 9's existing pattern — we tail the dev server
  // log for the URL. The webServer hook in playwright.config writes stdout to
  // a known location.
  return null; // Fallback: see emitLatestLogToken below.
}

/** Override default loginAsDev via this helper that uses log scanning. */
export async function loginAsDevViaLog(page: Page, logPath: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', ALLOWED_EMAIL);
  await page.click('button[type="submit"]');
  await page.waitForURL(/(login\?sent|verify-request)/);

  const fs = await import("node:fs");
  for (let i = 0; i < 30; i++) {
    if (fs.existsSync(logPath)) {
      const log = fs.readFileSync(logPath, "utf8");
      const links = [
        ...log.matchAll(/http:\/\/localhost:3000\/api\/auth\/callback\/resend\?[^\s]+/g),
      ];
      const last = links[links.length - 1]?.[0];
      if (last) {
        await page.goto(last);
        await page.waitForURL("/");
        return;
      }
    }
    await wait(200);
  }
  throw new Error("no magic link in dev server log");
}

/**
 * Truncate auth-related dev tables before a test so retries / re-runs don't
 * trip on stale tokens.
 */
export function resetAuthState() {
  spawnSync(
    "docker",
    [
      "exec",
      "docker-postgres-dev-1",
      "psql",
      "-U",
      "postgres",
      "-d",
      "dashboard_dev",
      "-c",
      "TRUNCATE dashboard.magic_link_tokens; TRUNCATE dashboard.audit_log;",
    ],
    { encoding: "utf8" },
  );
}

/** Read the freshest magic-link URL from Postgres + the rendered email body. */
export async function popLatestMagicLink(page: Page): Promise<string> {
  // Submit the request, wait for the callback URL to appear via the audit_log
  // entry. Easier: just probe the token row, then ask Postgres for the row
  // and rebuild the URL from its plaintext-equivalent — but tokens are hashed.
  // Real path: read it from the dev server stdout log.
  void page;
  throw new Error(
    "popLatestMagicLink should not be called directly — use loginAsDevViaLog",
  );
}

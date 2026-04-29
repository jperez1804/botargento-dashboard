import { defineConfig, devices } from "@playwright/test";

const BASE = "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  // Single worker — auth.spec and dashboard.spec share the same allowlisted
  // email, and both beforeEach hooks TRUNCATE dashboard.magic_link_tokens.
  // Running specs in parallel lets one worker wipe the other's freshly-issued
  // token, so the magic-link callback sees AccessDenied and the test hangs on
  // page.waitForURL("/"). Serializing across files keeps token + audit_log
  // state predictable.
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
  },
  // Dev server is started by scripts/run-e2e.sh outside of Playwright so we
  // can capture stdout into a known file (.playwright-dev-server.log) that
  // helpers.ts greps for the magic-link URL.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

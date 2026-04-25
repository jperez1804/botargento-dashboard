import { defineConfig, devices } from "@playwright/test";

const BASE = "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false, // single dev server, sequential keeps the audit_log + token state predictable
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

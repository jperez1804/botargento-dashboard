#!/usr/bin/env node
// Container startup check: every required automation.v_* view must exist
// in the tenant DB before Next.js boots. Surfacing this as a fast failure
// at boot beats the alternative — dashboards rendering "0" silently because
// a tenant was provisioned without the upstream reporting pipeline.

import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dotenvPath = resolve(__dirname, "..", ".env.local");
if (existsSync(dotenvPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(dotenvPath);
}

const REQUIRED_VIEWS = [
  "v_daily_metrics",
  "v_flow_breakdown",
  "v_contact_summary",
  "v_handoff_summary",
  "v_follow_up_queue",
];

const url = process.env.TENANT_DB_URL;
if (!url) {
  console.error("✗ TENANT_DB_URL is required");
  process.exit(1);
}

const sql = postgres(url, { max: 1, idle_timeout: 5 });

try {
  const rows = await sql`
    SELECT table_name AS name
    FROM information_schema.views
    WHERE table_schema = 'automation'
      AND table_name = ANY(${REQUIRED_VIEWS})
  `;
  const present = new Set(rows.map((r) => r.name));
  const missing = REQUIRED_VIEWS.filter((v) => !present.has(v));
  if (missing.length > 0) {
    console.error(`✗ Missing required views in automation schema:`);
    for (const v of missing) console.error(`    - automation.${v}`);
    console.error(
      `  This tenant's Postgres has not been initialized with the reporting pipeline.\n` +
        `  Run postgres-setup.sql from whatsapp-automation-claude before starting the dashboard.`,
    );
    process.exit(1);
  }
  console.log(`✓ All ${REQUIRED_VIEWS.length} required views present`);
} finally {
  await sql.end();
}

#!/usr/bin/env node
// Applies pending raw-SQL migrations from ./migrations/*.sql
// Tracks applied filenames in dashboard.__migrations.
// Supports psql-style :'VAR_NAME' substitution from process.env so the same
// SQL files work whether the operator pipes them to psql or the container
// applies them via this script.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, "..", "migrations");

const dotenvPath = resolve(__dirname, "..", ".env.local");
if (existsSync(dotenvPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(dotenvPath);
}

const url = process.env.TENANT_DB_URL;
if (!url) {
  console.error("✗ TENANT_DB_URL is required");
  process.exit(1);
}

const sql = postgres(url, { max: 1, idle_timeout: 5 });

function substitute(content) {
  return content.replace(/:'([A-Z_][A-Z0-9_]*)'/g, (_, varName) => {
    const v = process.env[varName] ?? "";
    return `'${v.replace(/'/g, "''")}'`;
  });
}

async function run() {
  try {
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS dashboard`);
  } catch (err) {
    // Provisioning creates the dashboard schema with an elevated DB user.
    // If the app role cannot create schemas at the database level, continue
    // as long as the schema already exists.
    if (err?.code !== "42501") throw err;
  }
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS dashboard.__migrations (
      filename    text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set(
    (await sql`SELECT filename FROM dashboard.__migrations`).map((r) => r.filename),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();

  let appliedThisRun = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  · ${file} — already applied`);
      continue;
    }
    const path = join(MIGRATIONS_DIR, file);
    const raw = readFileSync(path, "utf8");
    const content = substitute(raw);
    console.log(`  → applying ${file}`);
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`INSERT INTO dashboard.__migrations (filename) VALUES (${file})`;
      });
      appliedThisRun += 1;
      console.log(`  ✓ ${file}`);
    } catch (err) {
      console.error(`  ✗ ${file} failed:`, err.message);
      throw err;
    }
  }

  if (appliedThisRun === 0) {
    console.log("✓ Schema up to date");
  } else {
    console.log(`✓ Applied ${appliedThisRun} migration(s)`);
  }
  await sql.end();
}

run().catch((err) => {
  console.error("✗ Migration run failed:", err);
  process.exit(1);
});

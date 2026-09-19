// Schema probes for optional upstream objects. automation.* is owned by the
// n8n engine and not every tenant runs the same schema generation:
//   - lead_log.sent_by arrived with the two-way inbox,
//   - automation.session_memory is missing on some older tenants,
//   - outreach.* only exists on outbound (campaign) tenants.
// Referencing a missing column/table 42703s/42P01s the whole query, so the CRM
// probes once and branches its SQL. Cached per process with a TTL so a schema
// upgrade on the tenant is picked up without a dashboard restart.

import { sql } from "@/db/client";

const TTL_MS = 10 * 60_000;
const cache = new Map<string, { value: boolean; at: number }>();

async function probe(key: string, run: () => Promise<boolean>): Promise<boolean> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  let value = false;
  try {
    value = await run();
  } catch {
    // No USAGE on the schema, or similar: treat as absent (fail closed).
    value = false;
  }
  cache.set(key, { value, at: Date.now() });
  return value;
}

async function relationExists(name: string): Promise<boolean> {
  const rows = await sql<{ ok: boolean }[]>`SELECT to_regclass(${name}) IS NOT NULL AS ok`;
  return rows[0]?.ok === true;
}

export function hasLeadLogSentBy(): Promise<boolean> {
  return probe("lead_log.sent_by", async () => {
    const rows = await sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'automation' AND table_name = 'lead_log' AND column_name = 'sent_by'
    `;
    return rows.length > 0;
  });
}

export function hasSessionMemory(): Promise<boolean> {
  return probe("automation.session_memory", () => relationExists("automation.session_memory"));
}

export function hasOutreachSuppression(): Promise<boolean> {
  return probe("outreach.suppression", () => relationExists("outreach.suppression"));
}

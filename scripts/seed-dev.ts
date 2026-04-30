// Seed the local dev DB with 14 days of fake WhatsApp activity so that
// charts, tables, and the follow-up queue render against realistic shapes.
//
// Idempotent: TRUNCATEs the lead_log + escalations tables first, so re-running
// always yields the same window. Allowlist seeds are upserted, not replaced.
//
// Schema mirrors production (Phase 1): lead_log uses log_timestamp / text_body
// / handoff; escalations use escalation_timestamp / handoff_target.

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const INTENTS = ["Ventas", "Alquileres", "Tasaciones", "Emprendimientos", "Administracion", "Otras"];
const ROUTES = ["agent_qualifier", "menu", "human", "fallback"];
const HANDOFF_TARGETS = ["ventas@cliente.com", "alquileres@cliente.com", "admin@cliente.com"];

type Contact = { wa_id: string; name: string };

const CONTACTS: Contact[] = [
  { wa_id: "5491155501001", name: "Juan Pérez" },
  { wa_id: "5491155501002", name: "María González" },
  { wa_id: "5491155501003", name: "Carlos Rodríguez" },
  { wa_id: "5491155501004", name: "Lucía Fernández" },
  { wa_id: "5491155501005", name: "Diego Martínez" },
  { wa_id: "5491155501006", name: "Sofía López" },
  { wa_id: "5491155501007", name: "Mateo Sánchez" },
  { wa_id: "5491155501008", name: "Valentina Díaz" },
  { wa_id: "5491155501009", name: "Tomás Romero" },
  { wa_id: "5491155501010", name: "Camila Torres" },
  { wa_id: "5491155501011", name: "Joaquín Álvarez" },
  { wa_id: "5491155501012", name: "Martina Ruiz" },
  { wa_id: "5491155501013", name: "Benjamín Moreno" },
  { wa_id: "5491155501014", name: "Isabella Jiménez" },
  { wa_id: "5491155501015", name: "Lautaro Castro" },
];

// Reserved wa_ids that must never collect an escalation, so the follow-up
// queue can deterministically classify them as "medium" priority.
const MEDIUM_PRIORITY_WAID = "5491155503001";
const MEDIUM_PRIORITY_NAME = "Florencia Quiroga";

type LeadLogRow = {
  contact_wa_id: string;
  lead_name: string;
  direction: "inbound" | "outbound";
  intent: string;
  route: string;
  text_body: string;
  handoff: boolean;
  log_timestamp: string;
};

type EscalationRow = {
  contact_wa_id: string;
  lead_name: string;
  handoff_target: string;
  reason: string;
  escalation_type: "business" | "error";
  escalation_timestamp: string;
};

function pick<T>(arr: readonly T[]): T {
  const i = Math.floor(Math.random() * arr.length);
  return arr[i] as T;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function applyAutomationSchema() {
  // Drop the schema first so a previously-seeded dev DB whose tables drifted
  // from the canonical shape (column renames, dropped columns) is brought
  // forward cleanly. The setup file uses CREATE TABLE IF NOT EXISTS, which
  // would otherwise silently keep the old structure. Safe — this seed always
  // TRUNCATEs and re-inserts everything.
  // SET client_min_messages WARNING silences the cascade-drop NOTICE that
  // postgres.js dumps to stdout — purely cosmetic.
  await sql.unsafe(
    `SET client_min_messages = WARNING; DROP SCHEMA IF EXISTS automation CASCADE;`,
  );

  const path = resolve(__dirname, "dev-automation-setup.sql");
  const ddl = readFileSync(path, "utf8");
  await sql.unsafe(ddl);
  console.log("  ✓ automation schema + views applied");
}

async function seedAllowlist() {
  await sql`
    INSERT INTO dashboard.allowed_emails (email, role, created_by)
    VALUES
      ('dev@botargento.com.ar',     'viewer', 'seed'),
      ('owner@cliente.com',         'viewer', 'seed'),
      ('jonatanperez1804@gmail.com','viewer', 'seed')
    ON CONFLICT (email) DO NOTHING
  `;
  console.log("  ✓ allowlist seeded");
}

async function seedActivity() {
  await sql`TRUNCATE automation.lead_log RESTART IDENTITY`;
  await sql`TRUNCATE automation.escalations RESTART IDENTITY`;

  const now = new Date();
  const messageRows: LeadLogRow[] = [];

  // Background activity for the main contact pool across 14 days.
  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const inboundCount = isWeekend ? randInt(8, 14) : randInt(20, 35);

    for (let i = 0; i < inboundCount; i++) {
      const contact = pick(CONTACTS);
      const intent = pick(INTENTS);
      const route = pick(ROUTES);
      const ts = new Date(day);
      ts.setHours(randInt(8, 22), randInt(0, 59), randInt(0, 59));

      messageRows.push({
        contact_wa_id: contact.wa_id,
        lead_name: contact.name,
        direction: "inbound",
        intent,
        route,
        text_body: `Mensaje sobre ${intent.toLowerCase()}`,
        handoff: false,
        log_timestamp: ts.toISOString(),
      });

      if (Math.random() < 0.85) {
        const reply = new Date(ts.getTime() + randInt(30, 600) * 1000);
        messageRows.push({
          contact_wa_id: contact.wa_id,
          lead_name: contact.name,
          direction: "outbound",
          intent,
          route,
          text_body: "Respuesta automática del bot",
          handoff: false,
          log_timestamp: reply.toISOString(),
        });
      }
    }
  }

  // Guaranteed "medium" follow-up: ≥3 inbound in the last 7 days, no escalation.
  for (let i = 0; i < 4; i++) {
    const ts = new Date(now.getTime() - (i + 1) * 6 * 3600 * 1000);
    messageRows.push({
      contact_wa_id: MEDIUM_PRIORITY_WAID,
      lead_name: MEDIUM_PRIORITY_NAME,
      direction: "inbound",
      intent: "Alquileres",
      route: "agent_qualifier",
      text_body: "Consulta sobre alquileres",
      handoff: false,
      log_timestamp: ts.toISOString(),
    });
  }

  // Stale leads → "low" priority candidates (single inbound, no escalation,
  // last_seen older than several days).
  const staleSpec: Array<{ wa_id: string; name: string; intent: string; daysAgo: number }> = [
    { wa_id: "5491155502001", name: "Estela Beker",     intent: "Ventas",     daysAgo: 5 },
    { wa_id: "5491155502002", name: "Roberto Iglesias", intent: "Ventas",     daysAgo: 3 },
    { wa_id: "5491155502003", name: "Patricia Solé",    intent: "Tasaciones", daysAgo: 6 },
    { wa_id: "5491155502004", name: "Hernán Vega",      intent: "Tasaciones", daysAgo: 4 },
    { wa_id: "5491155502005", name: "Gabriela Núñez",   intent: "Otras",      daysAgo: 1 },
  ];
  for (const s of staleSpec) {
    const ts = new Date(now);
    ts.setDate(ts.getDate() - s.daysAgo);
    ts.setHours(11, 0, 0);
    messageRows.push({
      contact_wa_id: s.wa_id,
      lead_name: s.name,
      direction: "inbound",
      intent: s.intent,
      route: "agent_qualifier",
      text_body: `Consulta sobre ${s.intent.toLowerCase()}`,
      handoff: false,
      log_timestamp: ts.toISOString(),
    });
  }

  // Escalations: 12 business + 4 error. Force the first business escalation
  // into the last 24h so the follow-up queue always surfaces a "high" badge.
  const escalationRows: EscalationRow[] = [];

  const recentContact = pick(CONTACTS);
  const recentTs = new Date(now.getTime() - 6 * 3600 * 1000); // 6h ago
  escalationRows.push({
    contact_wa_id: recentContact.wa_id,
    lead_name: recentContact.name,
    handoff_target: pick(HANDOFF_TARGETS),
    reason: "El cliente solicitó hablar con un asesor humano",
    escalation_type: "business",
    escalation_timestamp: recentTs.toISOString(),
  });
  // Pair the recent escalation with an inbound lead_log row flagged handoff=true,
  // so v_daily_metrics.contacts_with_handoff is non-zero in dev.
  messageRows.push({
    contact_wa_id: recentContact.wa_id,
    lead_name: recentContact.name,
    direction: "inbound",
    intent: "Ventas",
    route: "human",
    text_body: "Quiero hablar con un asesor",
    handoff: true,
    log_timestamp: new Date(recentTs.getTime() - 60_000).toISOString(),
  });

  for (let i = 0; i < 11; i++) {
    const contact = pick(CONTACTS);
    const target = pick(HANDOFF_TARGETS);
    const dayOffset = randInt(2, 13); // older than 48h, so they classify as "low" not "high"
    const ts = new Date(now);
    ts.setDate(ts.getDate() - dayOffset);
    ts.setHours(randInt(9, 19), randInt(0, 59), randInt(0, 59));
    escalationRows.push({
      contact_wa_id: contact.wa_id,
      lead_name: contact.name,
      handoff_target: target,
      reason: "El cliente solicitó hablar con un asesor humano",
      escalation_type: "business",
      escalation_timestamp: ts.toISOString(),
    });
  }
  for (let i = 0; i < 4; i++) {
    const contact = pick(CONTACTS);
    const ts = new Date(now.getTime() - randInt(0, 13) * 86400_000);
    escalationRows.push({
      contact_wa_id: contact.wa_id,
      lead_name: contact.name,
      handoff_target: "",
      reason: `Internal error during workflow execution: ETIMEDOUT`,
      escalation_type: "error",
      escalation_timestamp: ts.toISOString(),
    });
  }

  // Insert in batches to keep the parameter count reasonable.
  const BATCH = 200;
  for (let i = 0; i < messageRows.length; i += BATCH) {
    const slice = messageRows.slice(i, i + BATCH);
    await sql`
      INSERT INTO automation.lead_log ${sql(
        slice,
        "contact_wa_id",
        "lead_name",
        "direction",
        "intent",
        "route",
        "text_body",
        "handoff",
        "log_timestamp",
      )}
    `;
  }
  console.log(`  ✓ ${messageRows.length} lead_log rows inserted`);

  await sql`
    INSERT INTO automation.escalations ${sql(
      escalationRows,
      "contact_wa_id",
      "lead_name",
      "handoff_target",
      "reason",
      "escalation_type",
      "escalation_timestamp",
    )}
  `;
  console.log(`  ✓ ${escalationRows.length} escalations inserted (12 business + 4 error)`);
}

async function main() {
  console.log("→ Applying dev automation schema");
  await applyAutomationSchema();
  console.log("→ Seeding dashboard.allowed_emails");
  await seedAllowlist();
  console.log("→ Seeding 14 days of fake activity");
  await seedActivity();
  console.log("✓ Dev seed complete");
  await sql.end();
}

main().catch(async (err) => {
  console.error("✗ Seed failed:", err);
  await sql.end({ timeout: 1 });
  process.exit(1);
});

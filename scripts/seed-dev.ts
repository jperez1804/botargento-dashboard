// Seed the local dev DB with 14 days of fake WhatsApp activity so that
// charts, tables, and the follow-up queue render against realistic shapes.
//
// Idempotent: TRUNCATEs the lead_log + escalations tables first, so re-running
// always yields the same window. Allowlist seeds are upserted, not replaced.

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

function pick<T>(arr: readonly T[]): T {
  const i = Math.floor(Math.random() * arr.length);
  return arr[i] as T;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function applyAutomationSchema() {
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
  const messageRows: Array<{
    contact_wa_id: string;
    display_name: string;
    direction: "inbound" | "outbound";
    intent: string | null;
    route: string | null;
    message_text: string;
    created_at: string;
  }> = [];

  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);
    // Volume curve: weekdays ~30 inbound, weekends ~10
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
        display_name: contact.name,
        direction: "inbound",
        intent,
        route,
        message_text: `Mensaje sobre ${intent.toLowerCase()}`,
        created_at: ts.toISOString(),
      });

      // Outbound reply ~85% of the time
      if (Math.random() < 0.85) {
        const reply = new Date(ts.getTime() + randInt(30, 600) * 1000);
        messageRows.push({
          contact_wa_id: contact.wa_id,
          display_name: contact.name,
          direction: "outbound",
          intent,
          route,
          message_text: "Respuesta automática del bot",
          created_at: reply.toISOString(),
        });
      }
    }
  }

  // Insert in batches to keep the parameter count reasonable
  const BATCH = 200;
  for (let i = 0; i < messageRows.length; i += BATCH) {
    const slice = messageRows.slice(i, i + BATCH);
    await sql`INSERT INTO automation.lead_log ${sql(slice, "contact_wa_id", "display_name", "direction", "intent", "route", "message_text", "created_at")}`;
  }
  console.log(`  ✓ ${messageRows.length} lead_log rows inserted`);

  // Escalations: pick ~12 business handoffs across the window + 4 error rows
  const escalationRows: Array<{
    contact_wa_id: string;
    display_name: string;
    target: string;
    reason: string;
    escalation_type: "business" | "error";
    created_at: string;
  }> = [];
  for (let i = 0; i < 12; i++) {
    const contact = pick(CONTACTS);
    const target = pick(HANDOFF_TARGETS);
    const dayOffset = randInt(0, 13);
    const ts = new Date(now);
    ts.setDate(ts.getDate() - dayOffset);
    ts.setHours(randInt(9, 19), randInt(0, 59), randInt(0, 59));
    escalationRows.push({
      contact_wa_id: contact.wa_id,
      display_name: contact.name,
      target,
      reason: "El cliente solicitó hablar con un asesor humano",
      escalation_type: "business",
      created_at: ts.toISOString(),
    });
  }
  for (let i = 0; i < 4; i++) {
    const contact = pick(CONTACTS);
    escalationRows.push({
      contact_wa_id: contact.wa_id,
      display_name: contact.name,
      target: "error-handler",
      reason: `Internal error during workflow execution: ETIMEDOUT`,
      escalation_type: "error",
      created_at: new Date(now.getTime() - randInt(0, 13) * 86400_000).toISOString(),
    });
  }
  await sql`INSERT INTO automation.escalations ${sql(escalationRows, "contact_wa_id", "display_name", "target", "reason", "escalation_type", "created_at")}`;
  console.log(`  ✓ ${escalationRows.length} escalations inserted (12 business + 4 error)`);

  // Stale leads so the follow-up queue has all three priority levels.
  // The view requires last_seen older than 2/3/12 hours for high/medium/low.
  const stale: Array<{
    contact_wa_id: string;
    display_name: string;
    direction: "inbound" | "outbound";
    intent: string | null;
    route: string | null;
    message_text: string;
    created_at: string;
  }> = [];
  const make = (waId: string, name: string, intent: string, daysAgo: number) => {
    const ts = new Date(now);
    ts.setDate(ts.getDate() - daysAgo);
    ts.setHours(11, 0, 0);
    stale.push({
      contact_wa_id: waId,
      display_name: name,
      direction: "inbound",
      intent,
      route: "agent_qualifier",
      message_text: `Consulta sobre ${intent.toLowerCase()}`,
      created_at: ts.toISOString(),
    });
  };
  // High: Ventas + last_seen >2 days old
  make("5491155502001", "Estela Beker",   "Ventas",     5);
  make("5491155502002", "Roberto Iglesias","Ventas",     3);
  // Medium: Tasaciones + last_seen >3 days old
  make("5491155502003", "Patricia Solé",   "Tasaciones", 6);
  make("5491155502004", "Hernán Vega",     "Tasaciones", 4);
  // Low: anything else with last_seen older than 12 hours
  make("5491155502005", "Gabriela Núñez",  "Otras",      1);
  await sql`INSERT INTO automation.lead_log ${sql(stale, "contact_wa_id", "display_name", "direction", "intent", "route", "message_text", "created_at")}`;
  console.log(`  ✓ ${stale.length} stale leads inserted (drives the follow-up queue)`);
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

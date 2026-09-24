// The read-time sync, against the real database: this is the rule "a handoff
// per rubro is an opportunity" expressed in SQL, and the only way to pin it is
// to run it. CI migrates and seeds before `pnpm test`, so the connection is
// there; locally it reads .env.local. Everything happens on a contact of its
// own (5491155509xxx) and is cleaned up afterwards.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const dotenv = resolve(process.cwd(), ".env.local");
if (existsSync(dotenv) && typeof process.loadEnvFile === "function") process.loadEnvFile(dotenv);

const WA = "5491155509001";
const hasDb = Boolean(process.env.TENANT_DB_URL);
const maybe = hasDb ? describe : describe.skip;

maybe("opportunity sync", () => {
  let sql: typeof import("@/db/client").sql;
  let config: NonNullable<typeof import("@/config/verticals/real-estate").realEstate.crm>;
  let sync: typeof import("@/lib/queries/opportunity-sync");

  beforeAll(async () => {
    ({ sql } = await import("@/db/client"));
    config = (await import("@/config/verticals/real-estate")).realEstate.crm!;
    sync = await import("@/lib/queries/opportunity-sync");
  });

  const clean = async () => {
    await sql`DELETE FROM dashboard.opportunities WHERE contact_wa_id = ${WA}`;
    await sql`DELETE FROM dashboard.contacts WHERE contact_wa_id = ${WA}`;
    await sql`DELETE FROM automation.escalations WHERE contact_wa_id = ${WA}`;
    await sql`DELETE FROM automation.lead_log WHERE contact_wa_id = ${WA}`;
  };

  /** A message with a rubro — never enough to open anything on its own. */
  const message = (intent: string, minutesAgo: number) => sql`
    INSERT INTO automation.lead_log
      (contact_wa_id, lead_name, direction, intent, route, text_body, sent_by, log_timestamp)
    VALUES (${WA}, 'Sync Tester', 'inbound', ${intent}, 'agent_qualifier', 'hola',
            '', NOW() - ${`${minutesAgo} minutes`}::interval)
  `;

  /** A handoff of a rubro — a fact the team has to work. */
  const handoff = (intent: string, minutesAgo: number) => sql`
    INSERT INTO automation.escalations
      (contact_wa_id, escalation_type, intent, escalation_timestamp, reason)
    VALUES (${WA}, 'business', ${intent}, NOW() - ${`${minutesAgo} minutes`}::interval, 'sync test')
  `;

  const opportunities = () =>
    sql<{ id: string; seq: number; kind: string; opened_by: string; closed_at: Date | null }[]>`
      SELECT id, seq, kind, opened_by, closed_at FROM dashboard.opportunities
      WHERE contact_wa_id = ${WA} ORDER BY seq
    `;

  const run = () => sync.syncOpportunities(config, [WA]);

  beforeEach(async () => {
    await clean();
    sync.invalidateIntentMap();
  });
  afterAll(async () => {
    await clean();
  });

  it("does not open anything for somebody who only wrote", async () => {
    await message("Ventas", 30);
    await run();
    const contact = await sql`SELECT 1 FROM dashboard.contacts WHERE contact_wa_id = ${WA}`;
    // The person exists — they are in Conversaciones, "Sin derivar".
    expect(contact).toHaveLength(1);
    expect(await opportunities()).toHaveLength(0);
  });

  it("opens one for a handoff, and running again changes nothing", async () => {
    await message("Ventas", 40);
    await handoff("Ventas", 30);
    await run();
    const first = await opportunities();
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ seq: 1, kind: "Ventas", opened_by: "", closed_at: null });

    await run();
    expect(await opportunities()).toHaveLength(1);
  });

  it("opens a second one for a handoff of another rubro, and leaves the first alone", async () => {
    await message("Ventas", 50);
    await handoff("Ventas", 40);
    await run();
    await handoff("Alquileres", 10);
    await run();

    const rows = await opportunities();
    expect(rows.map((r) => ({ seq: r.seq, kind: r.kind }))).toEqual([
      { seq: 1, kind: "Ventas" },
      { seq: 2, kind: "Alquileres" },
    ]);
    expect(rows.every((r) => r.closed_at === null)).toBe(true);
  });

  it("does not open a twin while one of that rubro is open", async () => {
    await message("Ventas", 50);
    await handoff("Ventas", 40);
    await run();
    await handoff("Ventas", 5);
    await run();
    expect(await opportunities()).toHaveLength(1);
  });

  it("opens a fresh one when the rubro's opportunity was closed", async () => {
    await message("Ventas", 130);
    await handoff("Ventas", 120);
    await run();
    await sql`
      UPDATE dashboard.opportunities
      SET stage = 'cerrado', closed_at = NOW() - '60 minutes'::interval
      WHERE contact_wa_id = ${WA}
    `;
    await handoff("Ventas", 5);
    await run();

    const rows = await opportunities();
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ seq: 2, kind: "Ventas", closed_at: null });
  });

  it("gives a rubro to an opportunity migrated without one", async () => {
    await message("Tasaciones", 40);
    await handoff("Tasaciones", 30);
    await sql`
      INSERT INTO dashboard.contacts (contact_wa_id, display_name, source, created_by)
      VALUES (${WA}, '', 'whatsapp', '')
    `;
    await sql`
      INSERT INTO dashboard.opportunities (contact_wa_id, seq, kind, opened_at, opened_by)
      VALUES (${WA}, 1, '', NOW() - '90 minutes'::interval, '')
    `;
    await run();

    const rows = await opportunities();
    // The handoff filled the blank instead of spawning a second card.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("Tasaciones");
  });

  it("ignores runtime errors, which are not handoffs", async () => {
    await sql`
      INSERT INTO automation.escalations
        (contact_wa_id, escalation_type, intent, escalation_timestamp, reason)
      VALUES (${WA}, 'workflow_error', 'Ventas', NOW(), 'sync test')
    `;
    await run();
    expect(await opportunities()).toHaveLength(0);
  });
});

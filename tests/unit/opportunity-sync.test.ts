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

  // ---------------------------------------------------------- reply opener
  // Outbound: WE wrote first, so a reply is what opens. The dev/CI database has
  // no outreach schema (it is the engine's), so the smallest possible one is
  // created here, once, before the first probe caches its answer.
  describe("reply opener (outbound)", () => {
    const WA2 = "5491155509002";
    let outbound: typeof config;

    beforeAll(async () => {
      outbound = (await import("@/config/verticals/outbound-sales")).outboundSales.crm!;
      await sql`CREATE SCHEMA IF NOT EXISTS outreach`;
      await sql`CREATE TABLE IF NOT EXISTS outreach.campaigns (
        id bigserial PRIMARY KEY, name text NOT NULL DEFAULT '', vertical text NOT NULL DEFAULT '')`;
      await sql`CREATE TABLE IF NOT EXISTS outreach.recipients (
        id bigserial PRIMARY KEY, campaign_id bigint, wa_id text NOT NULL,
        business_name text NOT NULL DEFAULT '', contact_name text NOT NULL DEFAULT '',
        vertical text NOT NULL DEFAULT '', source text NOT NULL DEFAULT '', opt_in_basis text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'pending', message_id text NOT NULL DEFAULT '',
        last_send_at timestamptz, touch_count int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
      await sql`CREATE TABLE IF NOT EXISTS outreach.suppression (
        wa_id text PRIMARY KEY, reason text NOT NULL DEFAULT '', campaign_id bigint,
        created_at timestamptz NOT NULL DEFAULT now())`;
      // The handoff-mode tests above already probed for these tables and cached
      // "absent" for ten minutes; forget that now that they exist.
      (await import("@/lib/crm/probes")).resetProbeCache();
    });

    const clean2 = async () => {
      await sql`DELETE FROM dashboard.opportunities WHERE contact_wa_id = ${WA2}`;
      await sql`DELETE FROM dashboard.contacts WHERE contact_wa_id = ${WA2}`;
      await sql`DELETE FROM automation.escalations WHERE contact_wa_id = ${WA2}`;
      await sql`DELETE FROM automation.lead_log WHERE contact_wa_id = ${WA2}`;
      await sql`DELETE FROM outreach.recipients WHERE wa_id = ${WA2}`;
      await sql`DELETE FROM outreach.suppression WHERE wa_id = ${WA2}`;
    };
    beforeEach(clean2);
    afterAll(clean2);

    const wroteTo = (vertical: string, daysAgo: number) => sql`
      INSERT INTO outreach.recipients (campaign_id, wa_id, business_name, vertical, status, last_send_at)
      VALUES (1, ${WA2}, 'Estudio Prueba', ${vertical}, 'sent', NOW() - ${`${daysAgo} days`}::interval)
    `;
    const replied = (minutesAgo: number) => sql`
      INSERT INTO automation.lead_log
        (contact_wa_id, lead_name, direction, intent, route, text_body, sent_by, log_timestamp)
      VALUES (${WA2}, 'Prueba', 'inbound', 'ventas_lead', 'guided_ventas_hoy', 'hola',
              '', NOW() - ${`${minutesAgo} minutes`}::interval)
    `;
    const askedForDemo = (minutesAgo: number) => sql`
      INSERT INTO automation.escalations
        (contact_wa_id, escalation_type, intent, escalation_timestamp, reason)
      VALUES (${WA2}, 'ventas_demo_requested', 'ventas_lead', NOW() - ${`${minutesAgo} minutes`}::interval, 'test')
    `;
    const opps2 = () =>
      sql<{ seq: number; kind: string; closed_at: Date | null }[]>`
        SELECT seq, kind, closed_at FROM dashboard.opportunities WHERE contact_wa_id = ${WA2} ORDER BY seq
      `;
    const runReply = (since: Date | null = null) =>
      sync.ensureContacts([WA2]).then(() => sync.ensureOpportunities(outbound, [WA2], { since }));

    it("opens on the first reply, with the rubro of the campaign that wrote to them", async () => {
      await wroteTo("architecture", 2);
      await replied(30);
      await runReply();
      const rows = await opps2();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ seq: 1, kind: "arquitectura", closed_at: null });
      // and the person came in through a campaign, not by writing first
      const c = await sql<{ source: string }[]>`SELECT source FROM dashboard.contacts WHERE contact_wa_id = ${WA2}`;
      expect(c[0]?.source).toBe("campaign");
    });

    it("does not open a twin on a second reply, nor on the handoff", async () => {
      await wroteTo("inmobiliaria", 2);
      await replied(40);
      await runReply();
      await replied(20);
      await askedForDemo(10);
      await runReply();
      expect(await opps2()).toHaveLength(1);
    });

    it("opens a fresh one when the last one was closed and the person writes again", async () => {
      await wroteTo("inmobiliaria", 5);
      await replied(200);
      await runReply();
      await sql`UPDATE dashboard.opportunities SET stage = 'perdido', closed_at = NOW() - '100 minutes'::interval WHERE contact_wa_id = ${WA2}`;
      await replied(5);
      await runReply();
      const rows = await opps2();
      expect(rows).toHaveLength(2);
      expect(rows[1]).toMatchObject({ seq: 2, kind: "inmobiliaria", closed_at: null });
    });

    it("ignores replies from before CRM_SINCE — history stays in Sin derivar", async () => {
      await wroteTo("inmobiliaria", 3);
      await replied(120);
      await runReply(new Date(Date.now() - 60 * 60_000));
      expect(await opps2()).toHaveLength(0);
      await replied(10);
      await runReply(new Date(Date.now() - 60 * 60_000));
      expect(await opps2()).toHaveLength(1);
    });

    it("leaves the rubro blank when no campaign wrote to them, to be filled by hand", async () => {
      await replied(15);
      await runReply();
      const rows = await opps2();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.kind).toBe("");
    });

    it("opens nothing for somebody who opted out", async () => {
      await wroteTo("inmobiliaria", 2);
      await sql`INSERT INTO outreach.suppression (wa_id, reason) VALUES (${WA2}, 'opted_out')`;
      await replied(5);
      await runReply();
      expect(await opps2()).toHaveLength(0);
    });
  });

  describe("strict rubros (architecture)", () => {
    let arch: NonNullable<typeof import("@/config/verticals/architecture").architecture.crm>;
    const runArch = () => sync.syncOpportunities(arch, [WA]);

    beforeAll(async () => {
      arch = (await import("@/config/verticals/architecture")).architecture.crm!;
    });
    beforeEach(async () => {
      await clean();
      sync.invalidateIntentMap();
    });
    afterAll(() => sync.invalidateIntentMap());

    it("opens one for a commercial handoff, with its rubro", async () => {
      await message("proyecto_lead", 40);
      await handoff("proyecto_lead", 30);
      await runArch();
      expect((await opportunities()).map((r) => r.kind)).toEqual(["proyecto_lead"]);
    });

    it("opens nothing for a supplier or job-seeker intake, nor for bot noise", async () => {
      await message("proveedor_intake", 50);
      await handoff("proveedor_intake", 40);
      await handoff("mano_obra_intake", 30);
      await message("unsupported_content", 20);
      await runArch();
      expect(await opportunities()).toHaveLength(0);
      const { listUnderivedConversations } = await import("@/lib/queries/underived");
      const underived = await listUnderivedConversations(arch, { limit: 1000 });
      expect(underived.some((u) => u.contactWaId === WA)).toBe(false);
    });

    it("still lists a stalled commercial conversation under Sin derivar", async () => {
      await message("gestiones_lead", 20);
      await runArch();
      const { listUnderivedConversations } = await import("@/lib/queries/underived");
      const underived = await listUnderivedConversations(arch, { limit: 1000 });
      expect(underived.find((u) => u.contactWaId === WA)?.kind).toBe("gestiones_lead");
    });
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

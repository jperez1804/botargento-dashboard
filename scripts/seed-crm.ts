// CRM-lite fixtures for the dev/CI seed. Deterministic contacts in the
// 55040xx range, one per stage/alert the UI must render. Each one owns an
// OPPORTUNITY with a fixed id (4001…), so the e2e can address cards, API
// bodies and SQL assertions without looking ids up:
//   A visita (manual, dev@) + activity · B reserva (manual, asesor@)
//   C nuevo, 25 idle days → "por vencer" · D 40 idle days → perdido (auto)
//   E overdue reminder (dev@) · F upcoming reminder (asesor@)
//   G human reply from the inbox (sent_by='human') → contactado (auto)
//   H registered by hand (walk-in, asesor@) — no WhatsApp conversation yet
//   I wrote with a rubro but never reached a handoff → NO opportunity: the
//     "Sin derivar" case, which lives in Conversaciones, not on the board
// Priorities: A alta, B media (the Resumen and the priority e2e count them).
// Budget: B has a manual USD 90.000. Intent: C is "Alquileres", the rest "Ventas".
// Plus: the seed's most recent business handoff gets qualification columns and
// a session_memory snapshot, so the "Lo que captó el bot" card has data
// without adding a 13th business escalation (the e2e expects exactly 12).
//
// Constraints kept on purpose: no new business escalations, no "Lucía" (the
// conversations search e2e expects one), and C/D don't disturb the follow-up
// priority badges (C lands as "Baja"; D is outside the 30-day window).

import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

const DAY = 86_400_000;

export const CRM_FIXTURES = {
  visita: { wa_id: "5491155504001", name: "Ramiro Ledesma", opp: 4001 },
  reserva: { wa_id: "5491155504002", name: "Agustina Ferraro", opp: 4002 },
  atRisk: { wa_id: "5491155504003", name: "Nora Paz", opp: 4003 },
  lost: { wa_id: "5491155504004", name: "Emilio Sosa", opp: 4004 },
  overdue: { wa_id: "5491155504005", name: "Pilar Quintana", opp: 4005 },
  upcoming: { wa_id: "5491155504006", name: "Bruno Acosta", opp: 4006 },
  contacted: { wa_id: "5491155504007", name: "Julieta Morales", opp: 4007 },
  manual: { wa_id: "5491155504008", name: "Horacio Benítez", opp: 4008 },
  // No opportunity on purpose: wrote, never derived.
  underived: { wa_id: "5491155504009", name: "Celeste Ruiz", opp: 0 },
} as const;

const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000);
const ahead = (days: number) => new Date(Date.now() + days * DAY);

/**
 * Resets the dashboard-side CRM state (team directory, contacts,
 * opportunities, lead_events) to the fixture baseline. Idempotent — the e2e
 * calls it before every CRM test so one test's moves don't leak into the next.
 *
 * Contacts for everyone else who wrote to the bot are recreated by the
 * read-time sync (lib/queries/opportunity-sync) on the next render, together
 * with the opportunities their handoffs have earned.
 */
export async function seedCrmState(sql: Sql): Promise<void> {
  const f = CRM_FIXTURES;
  await sql`
    TRUNCATE dashboard.contacts, dashboard.opportunities, dashboard.lead_events
    RESTART IDENTITY CASCADE
  `;
  await sql`TRUNCATE dashboard.team_members`;

  await sql`
    INSERT INTO dashboard.allowed_emails (email, role, created_by)
    VALUES ('asesor@cliente.com', 'asesor', 'seed')
    ON CONFLICT (email) DO UPDATE SET role = 'asesor'
  `;
  await sql`
    INSERT INTO dashboard.team_members (email, display_name, whatsapp_number, updated_by)
    VALUES
      ('dev@botargento.com.ar', 'Dev Admin',   '5491100000001', 'seed'),
      ('asesor@cliente.com',    'Ana Asesora', '5491100000002', 'seed')
  `;

  // The people. '' as the name means "use the WhatsApp profile".
  await sql`
    INSERT INTO dashboard.contacts (contact_wa_id, display_name, source, first_seen_at, created_by, created_at)
    VALUES
      (${f.visita.wa_id},    '', 'whatsapp', ${ago(2)},  '', ${ago(2)}),
      (${f.reserva.wa_id},   '', 'whatsapp', ${ago(3)},  '', ${ago(3)}),
      (${f.atRisk.wa_id},    '', 'whatsapp', ${ago(25)}, '', ${ago(25)}),
      (${f.lost.wa_id},      '', 'whatsapp', ${ago(40)}, '', ${ago(40)}),
      (${f.overdue.wa_id},   '', 'whatsapp', ${ago(4)},  '', ${ago(4)}),
      (${f.upcoming.wa_id},  '', 'whatsapp', ${ago(1)},  '', ${ago(1)}),
      (${f.contacted.wa_id}, '', 'whatsapp', ${ago(2)},  '', ${ago(2)}),
      (${f.underived.wa_id}, '', 'whatsapp', ${ago(2)},  '', ${ago(2)}),
      (${f.manual.wa_id}, ${f.manual.name}, 'visita', ${ago(1)}, 'asesor@cliente.com', ${ago(1)})
  `;

  // One opportunity each, with fixed ids the e2e addresses directly.
  await sql`
    INSERT INTO dashboard.opportunities
      (id, contact_wa_id, seq, kind, opened_at, opened_by,
       stage, stage_changed_at, stage_changed_by,
       owner_email, owner_assigned_at, owner_assigned_by,
       next_action_at, next_action_note, next_action_set_by, priority,
       budget_amount, budget_currency)
    VALUES
      (${f.visita.opp}, ${f.visita.wa_id}, 1, 'Ventas', ${ago(2)}, '',
       'visita', ${ago(1)}, 'dev@botargento.com.ar',
       'dev@botargento.com.ar', ${ago(2)}, 'dev@botargento.com.ar', NULL, '', '', 'alta', NULL, ''),
      (${f.reserva.opp}, ${f.reserva.wa_id}, 1, 'Ventas', ${ago(3)}, '',
       'reserva', ${ago(1)}, 'asesor@cliente.com',
       'asesor@cliente.com', ${ago(3)}, 'asesor@cliente.com', NULL, '', '', 'media', 90000, 'USD'),
      (${f.atRisk.opp}, ${f.atRisk.wa_id}, 1, 'Alquileres', ${ago(25)}, '',
       NULL, NULL, '', NULL, NULL, '', NULL, '', '', '', NULL, ''),
      (${f.lost.opp}, ${f.lost.wa_id}, 1, 'Ventas', ${ago(40)}, '',
       NULL, NULL, '', NULL, NULL, '', NULL, '', '', '', NULL, ''),
      (${f.overdue.opp}, ${f.overdue.wa_id}, 1, 'Ventas', ${ago(4)}, '',
       NULL, NULL, '',
       'dev@botargento.com.ar', ${ago(4)}, 'dev@botargento.com.ar',
       ${ago(1)}, 'Llamar para coordinar la visita', 'dev@botargento.com.ar', '', NULL, ''),
      (${f.upcoming.opp}, ${f.upcoming.wa_id}, 1, 'Ventas', ${ago(1)}, '',
       NULL, NULL, '',
       'asesor@cliente.com', ${ago(1)}, 'asesor@cliente.com',
       ${ahead(3)}, 'Mandar opciones en Belgrano', 'asesor@cliente.com', '', NULL, ''),
      (${f.contacted.opp}, ${f.contacted.wa_id}, 1, 'Ventas', ${ago(2)}, '',
       NULL, NULL, '', NULL, NULL, '', NULL, '', '', '', NULL, ''),
      (${f.manual.opp}, ${f.manual.wa_id}, 1, 'Ventas', ${ago(1)}, 'asesor@cliente.com',
       NULL, NULL, '',
       'asesor@cliente.com', ${ago(1)}, 'asesor@cliente.com', NULL, '', '', '', NULL, '')
  `;
  // Anything the app opens from here on gets an id well past the fixtures.
  await sql`SELECT setval('dashboard.opportunities_id_seq', 5000, false)`;

  const events = [
    { contact_wa_id: f.visita.wa_id, opportunity_id: f.visita.opp, kind: "note", body: "Busca 2 ambientes con balcón, hasta USD 150.000", occurred_at: ago(2), created_by: "dev@botargento.com.ar" },
    { contact_wa_id: f.visita.wa_id, opportunity_id: f.visita.opp, kind: "call", body: "Coordinamos visita para el sábado", occurred_at: ago(1, 2), created_by: "dev@botargento.com.ar" },
    { contact_wa_id: f.visita.wa_id, opportunity_id: f.visita.opp, kind: "stage_change", body: "", occurred_at: ago(1), created_by: "dev@botargento.com.ar" },
    { contact_wa_id: f.reserva.wa_id, opportunity_id: f.reserva.opp, kind: "stage_change", body: "", occurred_at: ago(1), created_by: "asesor@cliente.com" },
  ];
  const created = { contact_wa_id: f.manual.wa_id, kind: "created", body: "", occurred_at: ago(1), created_by: "asesor@cliente.com" };
  await sql`
    INSERT INTO dashboard.lead_events ${sql(
      events,
      "contact_wa_id",
      "opportunity_id",
      "kind",
      "body",
      "occurred_at",
      "created_by",
    )}
  `;
  await sql`
    INSERT INTO dashboard.lead_events
      (contact_wa_id, opportunity_id, kind, body, occurred_at, created_by, metadata)
    VALUES (${created.contact_wa_id}, ${f.manual.opp}, ${created.kind}, ${created.body},
            ${created.occurred_at}, ${created.created_by}, ${sql.json({ source: "visita" })})
  `;
}

export async function seedCrm(sql: Sql): Promise<void> {
  const f = CRM_FIXTURES;

  const inbound = (c: { wa_id: string; name: string }, at: Date, text: string) => ({
    contact_wa_id: c.wa_id,
    lead_name: c.name,
    direction: "inbound",
    intent: "Ventas",
    route: "agent_qualifier",
    text_body: text,
    sent_by: "",
    log_timestamp: at,
  });
  const logRows = [
    inbound(f.visita, ago(2), "Quiero ver el depto de Palermo"),
    inbound(f.reserva, ago(3), "Me interesa reservar"),
    { ...inbound(f.atRisk, ago(25), "Consulta por un PH"), intent: "Alquileres" },
    inbound(f.lost, ago(40), "Info de alquiler"),
    inbound(f.overdue, ago(4), "Busco 3 ambientes"),
    inbound(f.upcoming, ago(1), "Tienen algo en Belgrano?"),
    inbound(f.contacted, ago(2), "Hola, consulta"),
    // Wrote with a clear rubro but never reached a handoff (see header).
    inbound(f.underived, ago(2), "Hola, tienen algo para comprar en Caballito?"),
    {
      ...inbound(f.contacted, ago(1), "Hola Julieta, te escribo por tu consulta"),
      direction: "outbound",
      sent_by: "human",
    },
  ];
  await sql`
    INSERT INTO automation.lead_log ${sql(
      logRows,
      "contact_wa_id",
      "lead_name",
      "direction",
      "intent",
      "route",
      "text_body",
      "sent_by",
      "log_timestamp",
    )}
  `;

  // Handoffs carry the rubro they were about, the way the engine writes them
  // in production: it is what lets the read-time sync open one opportunity per
  // (person, rubro) instead of guessing.
  await sql`
    UPDATE automation.escalations e
    SET intent = COALESCE(
      (SELECT l.intent FROM automation.lead_log l
        WHERE l.contact_wa_id = e.contact_wa_id
          AND l.direction = 'inbound' AND NULLIF(l.intent, '') IS NOT NULL
        ORDER BY l.log_timestamp DESC LIMIT 1),
      'Otras'
    )
    WHERE e.escalation_type NOT IN ('workflow_error', 'error')
      AND COALESCE(e.intent, '') = ''
  `;

  await seedCrmState(sql);

  // Qualification data on the most recent business handoff (see header).
  const recent = await sql<{ contact_wa_id: string }[]>`
    UPDATE automation.escalations
    SET target_zone = 'Palermo',
        property_type = 'Departamento',
        bedrooms = 3,
        budget_amount = 150000,
        budget_currency = 'USD',
        purchase_timing = 'Próximos 3 meses',
        preferred_contact_slot = 'Tarde',
        transcript_summary = 'Busca 3 ambientes en Palermo para mudarse antes de fin de año.'
    WHERE id = (
      SELECT id FROM automation.escalations
      WHERE escalation_type = 'business'
      ORDER BY escalation_timestamp DESC
      LIMIT 1
    )
    RETURNING contact_wa_id
  `;
  const qualifiedWaId = recent[0]?.contact_wa_id;
  // selected_price_range is an object in real snapshots (the engine's
  // inventory wizard writes { min, max, label, currency }). F.upcoming gets one
  // without a label and no handoff amount, so its card shows the range itself.
  const snapshots = [
    ...(qualifiedWaId
      ? [
          {
            contact_wa_id: qualifiedWaId,
            qualification_snapshot_json: sql.json({
              selected_flow: "Ventas",
              selected_price_range: { min: 120000, max: 160000, label: "USD 120k – 160k", currency: "USD" },
            }),
          },
        ]
      : []),
    {
      contact_wa_id: f.upcoming.wa_id,
      qualification_snapshot_json: sql.json({
        selected_flow: "Ventas",
        selected_price_range: { min: 90000, max: 110000, currency: "USD" },
      }),
    },
  ];
  for (const s of snapshots) {
    await sql`
      INSERT INTO automation.session_memory (contact_wa_id, qualification_snapshot_json)
      VALUES (${s.contact_wa_id}, ${s.qualification_snapshot_json})
      ON CONFLICT (contact_wa_id) DO UPDATE SET qualification_snapshot_json = EXCLUDED.qualification_snapshot_json
    `;
  }

  console.log(
    `  ✓ CRM fixtures: ${logRows.length} lead_log rows + contacts / opportunities / lead_events / team baseline`,
  );
}

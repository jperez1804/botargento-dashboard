// CRM-lite fixtures for the dev/CI seed. Deterministic contacts in the
// 55040xx range, one per stage/alert the UI must render:
//   A visita (manual, dev@) + activity · B reserva (manual, asesor@)
//   C nuevo, 25 idle days → "por vencer" · D 40 idle days → perdido (auto)
//   E overdue reminder (dev@) · F upcoming reminder (asesor@)
//   G human reply from the inbox (sent_by='human') → contactado (auto)
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
  visita: { wa_id: "5491155504001", name: "Ramiro Ledesma" },
  reserva: { wa_id: "5491155504002", name: "Agustina Ferraro" },
  atRisk: { wa_id: "5491155504003", name: "Nora Paz" },
  lost: { wa_id: "5491155504004", name: "Emilio Sosa" },
  overdue: { wa_id: "5491155504005", name: "Pilar Quintana" },
  upcoming: { wa_id: "5491155504006", name: "Bruno Acosta" },
  contacted: { wa_id: "5491155504007", name: "Julieta Morales" },
} as const;

export async function seedCrm(sql: Sql): Promise<void> {
  const now = Date.now();
  const ago = (days: number, hours = 0) => new Date(now - days * DAY - hours * 3_600_000);
  const ahead = (days: number) => new Date(now + days * DAY);
  const f = CRM_FIXTURES;

  await sql`TRUNCATE dashboard.lead_events RESTART IDENTITY`;
  await sql`TRUNCATE dashboard.lead_state`;
  await sql`TRUNCATE dashboard.team_members`;

  await sql`
    INSERT INTO dashboard.team_members (email, display_name, whatsapp_number, updated_by)
    VALUES
      ('dev@botargento.com.ar', 'Dev Admin',   '5491100000001', 'seed'),
      ('asesor@cliente.com',    'Ana Asesora', '5491100000002', 'seed')
  `;

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
    inbound(f.atRisk, ago(25), "Consulta por un PH"),
    inbound(f.lost, ago(40), "Info de alquiler"),
    inbound(f.overdue, ago(4), "Busco 3 ambientes"),
    inbound(f.upcoming, ago(1), "Tienen algo en Belgrano?"),
    inbound(f.contacted, ago(2), "Hola, consulta"),
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

  await sql`
    INSERT INTO dashboard.lead_state
      (contact_wa_id, stage, stage_changed_at, stage_changed_by,
       owner_email, owner_assigned_at, owner_assigned_by,
       next_action_at, next_action_note, next_action_set_by)
    VALUES
      (${f.visita.wa_id}, 'visita', ${ago(1)}, 'dev@botargento.com.ar',
       'dev@botargento.com.ar', ${ago(2)}, 'dev@botargento.com.ar', NULL, '', ''),
      (${f.reserva.wa_id}, 'reserva', ${ago(1)}, 'asesor@cliente.com',
       'asesor@cliente.com', ${ago(3)}, 'asesor@cliente.com', NULL, '', ''),
      (${f.overdue.wa_id}, NULL, NULL, '',
       'dev@botargento.com.ar', ${ago(4)}, 'dev@botargento.com.ar',
       ${ago(1)}, 'Llamar para coordinar la visita', 'dev@botargento.com.ar'),
      (${f.upcoming.wa_id}, NULL, NULL, '',
       'asesor@cliente.com', ${ago(1)}, 'asesor@cliente.com',
       ${ahead(3)}, 'Mandar opciones en Belgrano', 'asesor@cliente.com')
  `;

  const events = [
    { contact_wa_id: f.visita.wa_id, kind: "note", body: "Busca 2 ambientes con balcón, hasta USD 150.000", occurred_at: ago(2), created_by: "dev@botargento.com.ar" },
    { contact_wa_id: f.visita.wa_id, kind: "call", body: "Coordinamos visita para el sábado", occurred_at: ago(1, 2), created_by: "dev@botargento.com.ar" },
    { contact_wa_id: f.visita.wa_id, kind: "stage_change", body: "", occurred_at: ago(1), created_by: "dev@botargento.com.ar" },
    { contact_wa_id: f.reserva.wa_id, kind: "stage_change", body: "", occurred_at: ago(1), created_by: "asesor@cliente.com" },
  ];
  await sql`
    INSERT INTO dashboard.lead_events ${sql(
      events,
      "contact_wa_id",
      "kind",
      "body",
      "occurred_at",
      "created_by",
    )}
  `;

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
  if (qualifiedWaId) {
    await sql`
      INSERT INTO automation.session_memory (contact_wa_id, qualification_snapshot_json)
      VALUES (${qualifiedWaId}, ${sql.json({ selected_flow: "Ventas", selected_price_range: "USD 120k – 160k" })})
      ON CONFLICT (contact_wa_id) DO UPDATE SET qualification_snapshot_json = EXCLUDED.qualification_snapshot_json
    `;
  }

  console.log(
    `  ✓ CRM fixtures: ${logRows.length} lead_log rows, 4 lead_state rows, ${events.length} lead_events, 2 team members`,
  );
}

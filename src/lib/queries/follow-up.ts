// Read paths for the follow-up queue. Production tenants currently expose
// follow-up metadata through reporting views that do not carry contact ids, so
// we rebuild the display rows directly from the upstream automation tables.

import { sql } from "@/db/client";
import type { FollowUpQueueRow } from "@/db/views";

export async function getFollowUpQueue(limit?: number): Promise<FollowUpQueueRow[]> {
  const rows = await sql<Record<string, unknown>[]>`
    WITH contact_activity AS (
      SELECT
        contact_wa_id,
        COALESCE(NULLIF(MAX(lead_name), ''), NULLIF(MAX(profile_name), ''), contact_wa_id) AS display_name,
        MAX(log_timestamp) AS last_seen,
        MAX(intent) FILTER (
          WHERE direction = 'inbound'
            AND log_timestamp = (
              SELECT MAX(l2.log_timestamp)
              FROM automation.lead_log l2
              WHERE l2.contact_wa_id = lead_log.contact_wa_id
                AND l2.direction = 'inbound'
            )
        ) AS last_intent,
        MAX(route) FILTER (
          WHERE log_timestamp = (
            SELECT MAX(l3.log_timestamp)
            FROM automation.lead_log l3
            WHERE l3.contact_wa_id = lead_log.contact_wa_id
          )
        ) AS last_route,
        COUNT(*) FILTER (
          WHERE direction = 'inbound'
            AND log_timestamp >= NOW() - INTERVAL '7 days'
        ) AS inbound_last_7d
      FROM automation.lead_log
      WHERE log_timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY contact_wa_id
    ),
    latest_handoff AS (
      SELECT DISTINCT ON (contact_wa_id)
        contact_wa_id,
        escalation_timestamp,
        handoff_target,
        reason
      FROM automation.escalations
      ORDER BY contact_wa_id, escalation_timestamp DESC
    )
    SELECT
      ca.contact_wa_id,
      ca.display_name,
      CASE
        WHEN lh.escalation_timestamp >= NOW() - INTERVAL '48 hours' THEN 'high'
        WHEN ca.inbound_last_7d >= 3 AND lh.contact_wa_id IS NULL THEN 'medium'
        ELSE 'low'
      END AS priority,
      CASE
        WHEN lh.escalation_timestamp >= NOW() - INTERVAL '48 hours'
          THEN COALESCE(NULLIF(lh.reason, ''), NULLIF(lh.handoff_target, ''), 'Derivacion reciente')
        WHEN ca.inbound_last_7d >= 3 AND lh.contact_wa_id IS NULL
          THEN COALESCE(NULLIF(ca.last_intent, ''), NULLIF(ca.last_route, ''), 'Alta actividad reciente')
        ELSE COALESCE(NULLIF(ca.last_intent, ''), NULLIF(ca.last_route, ''), 'Seguimiento sugerido')
      END AS reason,
      ca.last_seen
    FROM contact_activity ca
    LEFT JOIN latest_handoff lh ON lh.contact_wa_id = ca.contact_wa_id
    ORDER BY
      CASE
        WHEN lh.escalation_timestamp >= NOW() - INTERVAL '48 hours' THEN 0
        WHEN ca.inbound_last_7d >= 3 AND lh.contact_wa_id IS NULL THEN 1
        ELSE 2
      END,
      ca.last_seen DESC
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `;

  return rows.map((r) => {
    const p = String(r.priority);
    const priority: FollowUpQueueRow["priority"] =
      p === "high" || p === "medium" || p === "low" ? p : "low";
    return {
      contact_wa_id: String(r.contact_wa_id),
      display_name: r.display_name === null ? null : String(r.display_name),
      priority,
      reason: r.reason === null ? null : String(r.reason),
      last_seen: new Date(r.last_seen as string | Date).toISOString(),
    };
  });
}

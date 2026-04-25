// Read paths for the follow-up queue. The view already does the priority
// classification — we just order it for display and let the page slice
// (overview shows top 5, the dedicated page shows everything).

import { sql } from "@/db/client";
import type { FollowUpQueueRow } from "@/db/views";

export async function getFollowUpQueue(limit?: number): Promise<FollowUpQueueRow[]> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT contact_wa_id, display_name, priority, reason, last_seen
    FROM automation.v_follow_up_queue
    ORDER BY
      CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      last_seen ASC
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

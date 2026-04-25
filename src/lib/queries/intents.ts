// Aggregations against automation.v_flow_breakdown for the intents bar chart.

import { sql } from "@/db/client";

export type IntentCount = {
  intent: string;
  count: number;
};

/**
 * Sums inbound_count per intent across the last `days` days. Returns one row
 * per intent that appears in the window, sorted by count desc. The page
 * matches these `intent` strings against verticalConfig.intents to colour and
 * label them; intents not in the config show up under the "Otras" bucket.
 */
export async function getIntentCounts(days: number): Promise<IntentCount[]> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT
      COALESCE(intent, 'Otras') AS intent,
      COALESCE(SUM(inbound_count), 0)::int AS count
    FROM automation.v_flow_breakdown
    WHERE day >= CURRENT_DATE - ${days}::int
    GROUP BY 1
    ORDER BY 2 DESC
  `;
  return rows.map((r) => ({
    intent: String(r.intent),
    count: Number(r.count ?? 0),
  }));
}

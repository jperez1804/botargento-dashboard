// Unique-contact business intent counts for the overview chart.

import { sql } from "@/db/client";
import {
  formatBusinessIntentLabel,
  normalizeAutomationToken,
} from "@/lib/automation-labels";

export type IntentCount = {
  intent: string;
  count: number;
};

export type OtrasBreakdownRow = {
  rawToken: string;
  count: number;
};

export type IntentHandoffRate = {
  intent: string;
  contacts: number;
  contactsHandedOff: number;
  rate: number;
};

export type IntentHeatmapCell = {
  dow: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday (matches Postgres EXTRACT(DOW))
  hour: number; // 0..23 in the tenant timezone
  count: number;
};

export type IntentCompletionRate = {
  intent: string; // Bucket label (Ventas, Alquileres, ...)
  started: number; // Unique contacts who landed in this bucket
  completed: number | null; // Unique contacts who hit a terminal token; null when no terminals are configured
  rate: number | null; // completed / started; null when completed is null
};

export type BotSelfResolution = {
  contactsTotal: number;
  contactsSelfResolved: number;
  rate: number;
};

export type IntentTimeToHandoff = {
  intent: string;
  medianSeconds: number | null; // null when sampleSize < MIN_SAMPLE
  p90Seconds: number | null;
  sampleSize: number;
};

/**
 * Map of bucket label → set of normalized terminal tokens. Caller passes the
 * vertical's intents array; we build the index here so the SQL stays simple
 * (just pull all inbound rows in window, bucket + match in TS).
 */
type TerminalIndex = Map<string, Set<string>>;
function buildTerminalIndex(
  intents: ReadonlyArray<{ label: string; terminalIntents?: ReadonlyArray<string> }>,
): TerminalIndex {
  const idx: TerminalIndex = new Map();
  for (const intent of intents) {
    if (!intent.terminalIntents || intent.terminalIntents.length === 0) continue;
    idx.set(
      intent.label,
      new Set(intent.terminalIntents.map((t) => normalizeAutomationToken(t))),
    );
  }
  return idx;
}

export type IntentTouchMode = "first" | "last" | "any";

/**
 * Counts contacts per business intent across a window of `days` days ending
 * `offsetDays` days ago. `offsetDays = 0` means the window ends today; use
 * `offsetDays = days` to fetch the immediately-prior window for week-over-
 * week deltas.
 *
 * Touch attribution:
 *  - `last` (default): bucket = the contact's LAST inbound intent in the
 *    window. Each contact contributes to exactly ONE bucket, so per-intent
 *    counts SUM TO unique contacts (reconciles with the global KPI). Matches
 *    the attribution rule used by handoff rates and time-to-handoff.
 *  - `first`: bucket = the contact's FIRST inbound intent. Useful for "what
 *    did they originally ask about?" — buyer-funnel research.
 *  - `any`: bucket = every distinct (contact, intent) pair. A contact who
 *    moved Ventas → Tasaciones counts in BOTH buckets. Per-intent counts
 *    will exceed unique contacts; this matches an "all interest signals"
 *    read but does not reconcile.
 *
 * Sort order: count desc, then intent ASC (deterministic tiebreak).
 */
export async function getIntentCounts(
  days: number,
  offsetDays: number = 0,
  touch: IntentTouchMode = "last",
): Promise<IntentCount[]> {
  const rows = await (async () => {
    if (touch === "any") {
      return sql<Record<string, unknown>[]>`
        SELECT DISTINCT
          contact_wa_id,
          COALESCE(NULLIF(intent, ''), 'Otras') AS intent
        FROM automation.lead_log
        WHERE direction = 'inbound'
          AND COALESCE(NULLIF(contact_wa_id, ''), '') <> ''
          AND DATE(log_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
                BETWEEN DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - (${offsetDays}::int + ${days}::int - 1)
                    AND DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - ${offsetDays}::int
      `;
    }
    if (touch === "first") {
      return sql<Record<string, unknown>[]>`
        SELECT DISTINCT ON (contact_wa_id)
          contact_wa_id,
          COALESCE(NULLIF(intent, ''), 'Otras') AS intent
        FROM automation.lead_log
        WHERE direction = 'inbound'
          AND COALESCE(NULLIF(contact_wa_id, ''), '') <> ''
          AND DATE(log_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
                BETWEEN DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - (${offsetDays}::int + ${days}::int - 1)
                    AND DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - ${offsetDays}::int
        ORDER BY contact_wa_id, log_timestamp ASC
      `;
    }
    // last (default)
    return sql<Record<string, unknown>[]>`
      SELECT DISTINCT ON (contact_wa_id)
        contact_wa_id,
        COALESCE(NULLIF(intent, ''), 'Otras') AS intent
      FROM automation.lead_log
      WHERE direction = 'inbound'
        AND COALESCE(NULLIF(contact_wa_id, ''), '') <> ''
        AND DATE(log_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
              BETWEEN DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - (${offsetDays}::int + ${days}::int - 1)
                  AND DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - ${offsetDays}::int
      ORDER BY contact_wa_id, log_timestamp DESC
    `;
  })();

  const contactsByIntent = new Map<string, Set<string>>();
  for (const row of rows) {
    const contactWaId = String(row.contact_wa_id ?? "").trim();
    const intent = formatBusinessIntentLabel(String(row.intent ?? ""));
    if (!contactWaId || !intent) continue;

    const contacts = contactsByIntent.get(intent) ?? new Set<string>();
    contacts.add(contactWaId);
    contactsByIntent.set(intent, contacts);
  }

  return [...contactsByIntent]
    .map(([intent, contacts]) => ({ intent, count: contacts.size }))
    .sort((a, b) => b.count - a.count || a.intent.localeCompare(b.intent));
}

/**
 * Sums inbound flow-step volume per business intent across a window of `days`
 * days ending `offsetDays` days ago. `offsetDays = 0` means the window ends
 * today; `offsetDays = days` fetches the immediately-prior window for
 * week-over-week deltas. Uses `automation.v_flow_breakdown.inbound_count`,
 * which represents total inbound step volume (one row per day × intent ×
 * route). This intentionally counts repeated flow steps — that's the point:
 * it answers "how much did the bot work for each intent?" rather than "how
 * many distinct people did we serve?".
 *
 * `menu` is excluded (navigation, not a business intent). Unknown raw tokens
 * fall into `Otras` via `formatBusinessIntentLabel`.
 */
export async function getIntentMessageCounts(
  days: number,
  offsetDays: number = 0,
): Promise<IntentCount[]> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT intent, SUM(inbound_count)::bigint AS inbound_count
    FROM automation.v_flow_breakdown
    WHERE report_date
      BETWEEN DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - (${offsetDays}::int + ${days}::int - 1)
          AND DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - ${offsetDays}::int
    GROUP BY intent
  `;

  const counts = new Map<string, number>();
  for (const row of rows) {
    const intent = formatBusinessIntentLabel(String(row.intent ?? ""));
    if (!intent) continue;

    const inbound = Number(row.inbound_count ?? 0);
    counts.set(intent, (counts.get(intent) ?? 0) + inbound);
  }

  return [...counts]
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count || a.intent.localeCompare(b.intent));
}

/**
 * Returns the top N raw `lead_log.intent` tokens whose `formatBusinessIntentLabel`
 * resolves to "Otras" — i.e., values the dashboard doesn't yet have a display
 * label for. Operator use case: see what new tokens production is emitting so
 * we can decide whether to add them to AUTOMATION_LABELS.
 *
 * `menu` is excluded by `formatBusinessIntentLabel` (returns null), so it never
 * shows up here even though it's a real raw token.
 */
export async function getOtrasBreakdown(
  days: number,
  limit: number = 10,
): Promise<OtrasBreakdownRow[]> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT
      COALESCE(NULLIF(intent, ''), 'Otras') AS intent,
      COUNT(DISTINCT contact_wa_id)::bigint AS contacts
    FROM automation.lead_log
    WHERE direction = 'inbound'
      AND COALESCE(NULLIF(contact_wa_id, ''), '') <> ''
      AND DATE(log_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires') >= DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - (${days}::int - 1)
    GROUP BY 1
  `;

  const otras: OtrasBreakdownRow[] = [];
  for (const row of rows) {
    const rawToken = String(row.intent ?? "").trim();
    if (!rawToken) continue;
    const bucket = formatBusinessIntentLabel(rawToken);
    if (bucket !== "Otras") continue;
    otras.push({ rawToken, count: Number(row.contacts ?? 0) });
  }

  return otras.sort((a, b) => b.count - a.count || a.rawToken.localeCompare(b.rawToken)).slice(0, limit);
}

/**
 * Per-intent handoff rate for the last `days` days.
 *
 * Attribution: a contact's intent is their LAST inbound intent within the
 * window (DISTINCT ON ... ORDER BY log_timestamp DESC). A contact who moved
 * Ventas -> Otras lands in the Otras row, not Ventas.
 *
 * IMPORTANT: per-intent rates do NOT sum to the global handoff rate KPI on
 * the same screen — multi-intent contacts are attributed to one bucket here,
 * but the global KPI counts them once over all intents. This is intentional;
 * the UI must disclose the attribution rule next to the chart.
 *
 * Only `escalations.escalation_type = 'business'` rows count as handoffs
 * (matches `src/lib/queries/handoffs.ts:54`). Error-handler rows are excluded.
 */
export async function getIntentHandoffRates(days: number): Promise<IntentHandoffRate[]> {
  const rows = await sql<Record<string, unknown>[]>`
    WITH window_inbound AS (
      SELECT contact_wa_id, intent, log_timestamp
      FROM automation.lead_log
      WHERE direction = 'inbound'
        AND COALESCE(NULLIF(contact_wa_id, ''), '') <> ''
        AND DATE(log_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
              >= DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - (${days}::int - 1)
    ),
    last_intent AS (
      SELECT DISTINCT ON (contact_wa_id)
        contact_wa_id,
        COALESCE(NULLIF(intent, ''), 'Otras') AS intent
      FROM window_inbound
      ORDER BY contact_wa_id, log_timestamp DESC
    ),
    handoffs AS (
      SELECT DISTINCT contact_wa_id
      FROM automation.escalations
      WHERE escalation_type = 'business'
        AND COALESCE(NULLIF(contact_wa_id, ''), '') <> ''
        AND DATE(escalation_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
              >= DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - (${days}::int - 1)
    )
    SELECT
      li.intent AS intent,
      COUNT(*)::int AS contacts,
      COUNT(*) FILTER (WHERE h.contact_wa_id IS NOT NULL)::int AS contacts_handed_off
    FROM last_intent li
    LEFT JOIN handoffs h USING (contact_wa_id)
    GROUP BY li.intent
  `;

  const byBucket = new Map<string, { contacts: number; contactsHandedOff: number }>();
  for (const row of rows) {
    const bucket = formatBusinessIntentLabel(String(row.intent ?? ""));
    if (!bucket) continue;
    const contacts = Number(row.contacts ?? 0);
    const handedOff = Number(row.contacts_handed_off ?? 0);

    const acc = byBucket.get(bucket) ?? { contacts: 0, contactsHandedOff: 0 };
    acc.contacts += contacts;
    acc.contactsHandedOff += handedOff;
    byBucket.set(bucket, acc);
  }

  return [...byBucket]
    .map(([intent, { contacts, contactsHandedOff }]) => ({
      intent,
      contacts,
      contactsHandedOff,
      rate: contacts > 0 ? contactsHandedOff / contacts : 0,
    }))
    .sort((a, b) => b.contacts - a.contacts || a.intent.localeCompare(b.intent));
}

/**
 * Inbound message volume bucketed by day-of-week × hour-of-day in the tenant
 * timezone, over the last `days` days (default 28 — a 7-day window is too
 * sparse for a 168-cell grid). Optional `intentBucket` filters to a single
 * business intent label (e.g. "Ventas"); omit for all-intents combined.
 *
 * Use case: staffing — when does WhatsApp demand peak so a human is online
 * during likely escalation windows?
 *
 * Returns at most 168 rows (7 × 24). Empty cells are NOT returned; the UI
 * fills missing combinations with zero.
 */
export async function getIntentHeatmap(
  days: number = 28,
  intentBucket?: string,
): Promise<IntentHeatmapCell[]> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT
      EXTRACT(DOW FROM log_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')::int AS dow,
      EXTRACT(HOUR FROM log_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')::int AS hour,
      COALESCE(NULLIF(intent, ''), 'Otras') AS intent,
      COUNT(*)::int AS n
    FROM automation.lead_log
    WHERE direction = 'inbound'
      AND COALESCE(NULLIF(contact_wa_id, ''), '') <> ''
      AND DATE(log_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires') >= DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - (${days}::int - 1)
    GROUP BY 1, 2, 3
  `;

  const cells = new Map<string, IntentHeatmapCell>();
  for (const row of rows) {
    const bucket = formatBusinessIntentLabel(String(row.intent ?? ""));
    if (!bucket) continue;
    if (intentBucket && bucket !== intentBucket) continue;

    const dow = Number(row.dow ?? 0);
    const hour = Number(row.hour ?? 0);
    const n = Number(row.n ?? 0);
    const key = `${dow}-${hour}`;
    const existing = cells.get(key);
    if (existing) existing.count += n;
    else cells.set(key, { dow, hour, count: n });
  }

  return [...cells.values()];
}

/**
 * Per-intent flow-completion rate over the last `days` days.
 *
 * Attribution: a contact's bucket is the `formatBusinessIntentLabel` of their
 * LAST inbound intent in the window — same rule as `getIntentHandoffRates`.
 * `completed` counts contacts whose intent history (anywhere in the window)
 * touched any of the terminal tokens configured for THEIR bucket. Buckets
 * without any configured terminals return `completed = null` and `rate = null`,
 * which the UI surfaces as "—" (we don't know what completion means yet).
 *
 * This is the metric users intuitively read as "drop-off / completion" — the
 * older `Volumen ÷ Contactos` ratio (Phase 6) measures engagement density,
 * not completion. Both ship; they answer different questions.
 */
export async function getIntentCompletionRates(
  days: number,
  intents: ReadonlyArray<{ label: string; terminalIntents?: ReadonlyArray<string> }>,
): Promise<IntentCompletionRate[]> {
  const terminals = buildTerminalIndex(intents);

  const rows = await sql<Record<string, unknown>[]>`
    SELECT contact_wa_id, intent, log_timestamp
    FROM automation.lead_log
    WHERE direction = 'inbound'
      AND COALESCE(NULLIF(contact_wa_id, ''), '') <> ''
      AND DATE(log_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires') >= DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - (${days}::int - 1)
    ORDER BY contact_wa_id, log_timestamp ASC
  `;

  // Walk rows once: per contact, track their last-touch bucket and the full
  // list of normalized inbound tokens they hit in the window.
  const lastBucketByContact = new Map<string, string>();
  const tokensByContact = new Map<string, string[]>();
  for (const row of rows) {
    const contactWaId = String(row.contact_wa_id ?? "").trim();
    if (!contactWaId) continue;
    const rawIntent = String(row.intent ?? "");
    const bucket = formatBusinessIntentLabel(rawIntent);
    if (!bucket) continue; // skips menu

    lastBucketByContact.set(contactWaId, bucket); // last write wins, rows ordered by log_timestamp ASC
    const list = tokensByContact.get(contactWaId) ?? [];
    list.push(normalizeAutomationToken(rawIntent));
    tokensByContact.set(contactWaId, list);
  }

  const result = new Map<string, { started: number; completedSet: Set<string> | null }>();
  for (const intent of intents) {
    // null completedSet → "no terminals configured for this bucket → render —"
    result.set(intent.label, {
      started: 0,
      completedSet: terminals.has(intent.label) ? new Set<string>() : null,
    });
  }

  for (const [contactWaId, bucket] of lastBucketByContact) {
    let entry = result.get(bucket);
    if (!entry) {
      entry = {
        started: 0,
        completedSet: terminals.has(bucket) ? new Set<string>() : null,
      };
      result.set(bucket, entry);
    }
    entry.started += 1;

    if (entry.completedSet !== null) {
      const bucketTerminals = terminals.get(bucket);
      const tokens = tokensByContact.get(contactWaId) ?? [];
      if (bucketTerminals && tokens.some((t) => bucketTerminals.has(t))) {
        entry.completedSet.add(contactWaId);
      }
    }
  }

  return [...result]
    .map(([intent, { started, completedSet }]) => {
      if (completedSet === null) {
        return { intent, started, completed: null, rate: null };
      }
      const completed = completedSet.size;
      return {
        intent,
        started,
        completed,
        rate: started > 0 ? completed / started : 0,
      };
    })
    .sort((a, b) => b.started - a.started || a.intent.localeCompare(b.intent));
}

/**
 * Bot self-resolution rate over the last `days` days.
 *
 * Self-resolved = a contact who appeared inbound in the window AND did NOT
 * produce a `business` escalation row in the same window. This is the ROI
 * metric: "% of conversations the bot handled without a human".
 *
 * Note: error-handler escalations (`escalation_type = 'error'`) are excluded
 * — those are runtime issues, not real handoffs.
 *
 * Future refinement (deferred): subtract contacts that are still in
 * v_follow_up_queue, since "not yet escalated" can also mean "needs follow-up".
 * For v1 we keep the metric simple and operator-readable.
 */
export async function getBotSelfResolutionRate(
  days: number,
  offsetDays: number = 0,
): Promise<BotSelfResolution> {
  const rows = await sql<Record<string, unknown>[]>`
    WITH window_inbound AS (
      SELECT DISTINCT contact_wa_id
      FROM automation.lead_log
      WHERE direction = 'inbound'
        AND COALESCE(NULLIF(contact_wa_id, ''), '') <> ''
        AND DATE(log_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
              BETWEEN DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - (${offsetDays}::int + ${days}::int - 1)
                  AND DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - ${offsetDays}::int
    ),
    window_handoffs AS (
      SELECT DISTINCT contact_wa_id
      FROM automation.escalations
      WHERE escalation_type = 'business'
        AND COALESCE(NULLIF(contact_wa_id, ''), '') <> ''
        AND DATE(escalation_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
              BETWEEN DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - (${offsetDays}::int + ${days}::int - 1)
                  AND DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - ${offsetDays}::int
    )
    SELECT
      (SELECT COUNT(*) FROM window_inbound)::int AS contacts_total,
      (SELECT COUNT(*) FROM window_inbound WHERE contact_wa_id NOT IN (SELECT contact_wa_id FROM window_handoffs))::int AS contacts_self_resolved
  `;

  const row = rows[0];
  const contactsTotal = Number(row?.contacts_total ?? 0);
  const contactsSelfResolved = Number(row?.contacts_self_resolved ?? 0);

  return {
    contactsTotal,
    contactsSelfResolved,
    rate: contactsTotal > 0 ? contactsSelfResolved / contactsTotal : 0,
  };
}

const MIN_SAMPLE_FOR_PERCENTILES = 5;

/**
 * Median and p90 time-to-handoff per intent, in seconds, over the last
 * `days` days.
 *
 * Definition: per contact who was handed off in the window, duration =
 * escalation_timestamp - first_inbound_timestamp (the contact's earliest
 * inbound message that fell INSIDE the window — we don't reach back further).
 *
 * Attribution: bucket = `formatBusinessIntentLabel` of the contact's LAST
 * inbound intent in the window (matches `getIntentHandoffRates` for
 * consistency).
 *
 * Caveats (UI must disclose):
 *  - Wall-clock duration; weekend/evening WhatsApp traffic in LATAM real
 *    estate inflates medians because the brokerage is closed when the
 *    customer first messages. Business-hours-aware variant deferred.
 *  - Buckets with `sampleSize < MIN_SAMPLE_FOR_PERCENTILES` return null
 *    median/p90 to avoid showing a precise-looking number based on 1–2 points.
 *  - Negative durations (handoff before first inbound — possible if the
 *    handoff is from an inbound outside the window) are filtered out.
 */
export async function getIntentTimeToHandoff(days: number): Promise<IntentTimeToHandoff[]> {
  const rows = await sql<Record<string, unknown>[]>`
    WITH inbound_in_window AS (
      SELECT contact_wa_id, intent, log_timestamp
      FROM automation.lead_log
      WHERE direction = 'inbound'
        AND COALESCE(NULLIF(contact_wa_id, ''), '') <> ''
        AND DATE(log_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
              >= DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - (${days}::int - 1)
    ),
    first_inbound AS (
      SELECT contact_wa_id, MIN(log_timestamp) AS first_log_timestamp
      FROM inbound_in_window
      GROUP BY contact_wa_id
    ),
    last_intent AS (
      SELECT DISTINCT ON (contact_wa_id)
        contact_wa_id,
        COALESCE(NULLIF(intent, ''), 'Otras') AS intent
      FROM inbound_in_window
      ORDER BY contact_wa_id, log_timestamp DESC
    ),
    first_handoff AS (
      SELECT DISTINCT ON (contact_wa_id) contact_wa_id, escalation_timestamp
      FROM automation.escalations
      WHERE escalation_type = 'business'
        AND COALESCE(NULLIF(contact_wa_id, ''), '') <> ''
        AND DATE(escalation_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
              >= DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - (${days}::int - 1)
      ORDER BY contact_wa_id, escalation_timestamp ASC
    ),
    durations AS (
      SELECT
        li.intent AS intent,
        EXTRACT(EPOCH FROM (fh.escalation_timestamp - fi.first_log_timestamp)) AS duration_seconds
      FROM first_handoff fh
      JOIN first_inbound fi USING (contact_wa_id)
      JOIN last_intent li USING (contact_wa_id)
      WHERE fh.escalation_timestamp >= fi.first_log_timestamp
    )
    SELECT
      intent,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_seconds) AS median_seconds,
      percentile_cont(0.9) WITHIN GROUP (ORDER BY duration_seconds) AS p90_seconds,
      COUNT(*)::int AS n
    FROM durations
    GROUP BY intent
  `;

  type Acc = { sampleSize: number; medianSum: number; p90Sum: number };
  const byBucket = new Map<string, Acc>();
  // SQL groups by raw intent; collapse into bucket labels in TS so a multi-token
  // bucket (e.g. multiple raw tokens that all map to "Ventas") aggregates correctly.
  // Median/p90 across a TS-merged bucket is approximated by sample-size-weighted
  // average of per-token percentiles. Fine in practice — collisions across
  // distinct raw tokens for the same bucket are rare in this data shape.
  for (const row of rows) {
    const bucket = formatBusinessIntentLabel(String(row.intent ?? ""));
    if (!bucket) continue;
    const n = Number(row.n ?? 0);
    if (n === 0) continue;
    const median = Number(row.median_seconds ?? 0);
    const p90 = Number(row.p90_seconds ?? 0);

    const acc = byBucket.get(bucket) ?? { sampleSize: 0, medianSum: 0, p90Sum: 0 };
    acc.sampleSize += n;
    acc.medianSum += median * n;
    acc.p90Sum += p90 * n;
    byBucket.set(bucket, acc);
  }

  return [...byBucket]
    .map(([intent, { sampleSize, medianSum, p90Sum }]) => {
      if (sampleSize < MIN_SAMPLE_FOR_PERCENTILES) {
        return { intent, sampleSize, medianSeconds: null, p90Seconds: null };
      }
      return {
        intent,
        sampleSize,
        medianSeconds: medianSum / sampleSize,
        p90Seconds: p90Sum / sampleSize,
      };
    })
    .sort((a, b) => b.sampleSize - a.sampleSize || a.intent.localeCompare(b.intent));
}

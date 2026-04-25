-- Dev-only stand-in for the upstream whatsapp-automation-claude schema.
-- In production each tenant brings its own automation.* tables + views
-- (created by postgres-setup.sql in whatsapp-automation-claude). Locally we
-- recreate enough of that surface area for the dashboard to render against
-- realistic-looking data.
--
-- Idempotent: safe to re-run.

CREATE SCHEMA IF NOT EXISTS automation;

-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation.lead_log (
  id            bigserial PRIMARY KEY,
  contact_wa_id text NOT NULL,
  display_name  text,
  direction     text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  intent        text,
  route         text,
  message_text  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_log_contact_wa_id
  ON automation.lead_log (contact_wa_id);
CREATE INDEX IF NOT EXISTS idx_lead_log_created_at
  ON automation.lead_log (created_at DESC);

CREATE TABLE IF NOT EXISTS automation.escalations (
  id              bigserial PRIMARY KEY,
  contact_wa_id   text NOT NULL,
  display_name    text,
  target          text NOT NULL,
  reason          text,
  escalation_type text NOT NULL DEFAULT 'business',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalations_created_at
  ON automation.escalations (created_at DESC);

-- ── Views ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW automation.v_daily_metrics AS
WITH days AS (
  SELECT
    (date_trunc('day', created_at AT TIME ZONE 'America/Argentina/Buenos_Aires'))::date AS day,
    direction,
    contact_wa_id
  FROM automation.lead_log
), agg AS (
  SELECT
    day,
    count(*) FILTER (WHERE direction = 'inbound')          AS inbound_count,
    count(*) FILTER (WHERE direction = 'outbound')         AS outbound_count,
    count(DISTINCT contact_wa_id)                          AS unique_contacts
  FROM days
  GROUP BY day
), handoffs AS (
  SELECT
    (date_trunc('day', created_at AT TIME ZONE 'America/Argentina/Buenos_Aires'))::date AS day,
    count(*) AS handoff_count
  FROM automation.escalations
  WHERE escalation_type = 'business'
  GROUP BY day
)
SELECT
  agg.day,
  agg.inbound_count,
  agg.outbound_count,
  agg.unique_contacts,
  COALESCE(handoffs.handoff_count, 0)                                          AS handoff_count,
  CASE
    WHEN agg.inbound_count = 0 THEN 0::numeric
    ELSE ROUND(100.0 * COALESCE(handoffs.handoff_count, 0)::numeric / agg.inbound_count, 2)
  END                                                                          AS handoff_rate
FROM agg
LEFT JOIN handoffs USING (day);

CREATE OR REPLACE VIEW automation.v_flow_breakdown AS
SELECT
  (date_trunc('day', created_at AT TIME ZONE 'America/Argentina/Buenos_Aires'))::date AS day,
  intent,
  route,
  count(*) AS inbound_count
FROM automation.lead_log
WHERE direction = 'inbound'
GROUP BY 1, 2, 3;

CREATE OR REPLACE VIEW automation.v_contact_summary AS
WITH last_intent AS (
  SELECT DISTINCT ON (contact_wa_id)
    contact_wa_id,
    intent
  FROM automation.lead_log
  WHERE intent IS NOT NULL
  ORDER BY contact_wa_id, created_at DESC
), per_contact AS (
  SELECT
    contact_wa_id,
    max(display_name)                                  AS display_name,
    min(created_at)                                    AS first_seen,
    max(created_at)                                    AS last_seen,
    count(*)                                           AS message_count
  FROM automation.lead_log
  GROUP BY contact_wa_id
), handoffs AS (
  SELECT
    contact_wa_id,
    count(*) AS handoff_count
  FROM automation.escalations
  WHERE escalation_type = 'business'
  GROUP BY contact_wa_id
)
SELECT
  pc.contact_wa_id,
  pc.display_name,
  pc.first_seen,
  pc.last_seen,
  pc.message_count,
  li.intent                          AS last_intent,
  COALESCE(h.handoff_count, 0)       AS handoff_count
FROM per_contact pc
LEFT JOIN last_intent li USING (contact_wa_id)
LEFT JOIN handoffs h    USING (contact_wa_id);

CREATE OR REPLACE VIEW automation.v_handoff_summary AS
SELECT
  target,
  count(*)                                                   AS count_all_time,
  count(*) FILTER (WHERE created_at >= now() - INTERVAL '24 hours') AS count_24h
FROM automation.escalations
WHERE escalation_type = 'business'
GROUP BY target;

CREATE OR REPLACE VIEW automation.v_follow_up_queue AS
WITH base AS (
  SELECT
    contact_wa_id,
    max(display_name)             AS display_name,
    max(created_at)               AS last_seen,
    bool_or(intent = 'Ventas')    AS has_sales_intent,
    bool_or(intent = 'Tasaciones') AS has_appraisal_intent
  FROM automation.lead_log
  GROUP BY contact_wa_id
)
SELECT
  contact_wa_id,
  display_name,
  CASE
    WHEN has_sales_intent  AND last_seen < now() - INTERVAL '2 days' THEN 'high'
    WHEN has_appraisal_intent AND last_seen < now() - INTERVAL '3 days' THEN 'medium'
    ELSE 'low'
  END                                AS priority,
  CASE
    WHEN has_sales_intent  AND last_seen < now() - INTERVAL '2 days' THEN 'Lead de Ventas sin respuesta'
    WHEN has_appraisal_intent AND last_seen < now() - INTERVAL '3 days' THEN 'Tasación pendiente de seguimiento'
    ELSE 'Contacto reciente'
  END                                AS reason,
  last_seen
FROM base
WHERE last_seen < now() - INTERVAL '12 hours';

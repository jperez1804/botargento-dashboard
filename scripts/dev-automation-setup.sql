-- Dev-only stand-in for the upstream whatsapp-automation-claude schema.
-- Mirrors the production automation.* tables + views (Phase 1 contract):
-- lead_log uses log_timestamp / text_body / handoff, escalations use
-- escalation_timestamp / handoff_target, and the v_* views emit the
-- canonical reporting column names the dashboard queries against.
--
-- Idempotent: safe to re-run.

CREATE SCHEMA IF NOT EXISTS automation;

-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation.lead_log (
  id              BIGSERIAL PRIMARY KEY,
  log_timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  direction       TEXT NOT NULL,
  event_type      TEXT NOT NULL DEFAULT 'message',
  route           TEXT NOT NULL DEFAULT '',
  contact_wa_id   TEXT NOT NULL DEFAULT '',
  profile_name    TEXT NOT NULL DEFAULT '',
  lead_name       TEXT NOT NULL DEFAULT '',
  message_type    TEXT NOT NULL DEFAULT '',
  text_body       TEXT NOT NULL DEFAULT '',
  intent          TEXT NOT NULL DEFAULT '',
  handoff         BOOLEAN NOT NULL DEFAULT FALSE,
  handoff_reason  TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_lead_log_contact_timestamp
  ON automation.lead_log (contact_wa_id, log_timestamp DESC);
CREATE INDEX IF NOT EXISTS ix_lead_log_log_timestamp
  ON automation.lead_log (log_timestamp DESC);

CREATE TABLE IF NOT EXISTS automation.escalations (
  id                     BIGSERIAL PRIMARY KEY,
  escalation_timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  escalation_type        TEXT NOT NULL DEFAULT '',
  contact_wa_id          TEXT NOT NULL DEFAULT '',
  profile_name           TEXT NOT NULL DEFAULT '',
  lead_name              TEXT NOT NULL DEFAULT '',
  reason                 TEXT NOT NULL DEFAULT '',
  intent                 TEXT NOT NULL DEFAULT '',
  handoff_target         TEXT NOT NULL DEFAULT '',
  preferred_contact_slot TEXT NOT NULL DEFAULT '',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_escalations_timestamp
  ON automation.escalations (escalation_timestamp DESC);
CREATE INDEX IF NOT EXISTS ix_escalations_handoff_target
  ON automation.escalations (handoff_target);

-- ── Views (must match production column contract) ───────────────────────────

CREATE OR REPLACE VIEW automation.v_daily_metrics AS
SELECT
  DATE(log_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires') AS report_date,
  COUNT(*) FILTER (WHERE direction = 'inbound')                     AS inbound_messages,
  COUNT(*) FILTER (WHERE direction = 'outbound')                    AS outbound_messages,
  COUNT(DISTINCT contact_wa_id) FILTER (WHERE direction = 'inbound')                          AS unique_contacts,
  COUNT(DISTINCT contact_wa_id) FILTER (WHERE direction = 'inbound' AND handoff = true)       AS contacts_with_handoff,
  ROUND(
    COUNT(DISTINCT contact_wa_id) FILTER (WHERE direction = 'inbound' AND handoff = true)::numeric
    / NULLIF(COUNT(DISTINCT contact_wa_id) FILTER (WHERE direction = 'inbound'), 0),
    4
  ) AS handoff_rate
FROM automation.lead_log
GROUP BY 1
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW automation.v_flow_breakdown AS
SELECT
  DATE(log_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires') AS report_date,
  COALESCE(NULLIF(intent, ''), '(none)')  AS intent,
  COALESCE(NULLIF(route, ''), '(none)')   AS route,
  COUNT(*)                                AS inbound_count,
  COUNT(DISTINCT contact_wa_id)           AS unique_contacts
FROM automation.lead_log
WHERE direction = 'inbound'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 4 DESC;

CREATE OR REPLACE VIEW automation.v_contact_summary AS
SELECT
  l.contact_wa_id,
  COALESCE(NULLIF(MAX(l.lead_name), ''), NULLIF(MAX(l.profile_name), ''), l.contact_wa_id) AS display_name,
  MIN(l.log_timestamp)                                      AS first_seen,
  MAX(l.log_timestamp)                                      AS last_seen,
  COUNT(*) FILTER (WHERE l.direction = 'inbound')           AS inbound_count,
  COUNT(*) FILTER (WHERE l.direction = 'outbound')          AS outbound_count,
  COUNT(*)                                                  AS total_messages,
  MAX(l.intent) FILTER (WHERE l.direction = 'inbound'
    AND l.log_timestamp = (
      SELECT MAX(l2.log_timestamp) FROM automation.lead_log l2
      WHERE l2.contact_wa_id = l.contact_wa_id AND l2.direction = 'inbound'))
                                                            AS last_intent,
  MAX(l.route) FILTER (WHERE l.log_timestamp = (
      SELECT MAX(l3.log_timestamp) FROM automation.lead_log l3
      WHERE l3.contact_wa_id = l.contact_wa_id))            AS last_route,
  COUNT(DISTINCT e.id)                                      AS handoff_count,
  MAX(e.handoff_target)                                     AS last_handoff_target,
  MAX(e.preferred_contact_slot)                             AS preferred_contact_slot,
  MAX(l.text_body) FILTER (WHERE l.direction = 'inbound'
    AND l.log_timestamp = (
      SELECT MAX(l4.log_timestamp) FROM automation.lead_log l4
      WHERE l4.contact_wa_id = l.contact_wa_id AND l4.direction = 'inbound'))
                                                            AS latest_user_message
FROM automation.lead_log l
LEFT JOIN automation.escalations e
  ON e.contact_wa_id = l.contact_wa_id
 AND e.escalation_type = 'business'
GROUP BY l.contact_wa_id;

CREATE OR REPLACE VIEW automation.v_handoff_summary AS
SELECT
  COALESCE(NULLIF(handoff_target, ''), 'unspecified')                              AS handoff_target,
  COUNT(*)                                                                          AS total_count,
  COUNT(*) FILTER (WHERE escalation_timestamp >= NOW() - INTERVAL '24 hours')       AS last_24h_count,
  MAX(escalation_timestamp)                                                         AS last_handoff_timestamp
FROM automation.escalations
WHERE escalation_type = 'business'
GROUP BY 1;

CREATE OR REPLACE VIEW automation.v_follow_up_queue AS
WITH contact_activity AS (
  SELECT
    contact_wa_id,
    COALESCE(NULLIF(MAX(lead_name), ''), NULLIF(MAX(profile_name), ''), contact_wa_id) AS display_name,
    MAX(log_timestamp)                                  AS last_seen,
    COUNT(*) FILTER (WHERE direction = 'inbound'
      AND log_timestamp >= NOW() - INTERVAL '7 days')   AS inbound_last_7d
  FROM automation.lead_log
  WHERE log_timestamp >= NOW() - INTERVAL '30 days'
  GROUP BY contact_wa_id
),
latest_handoff AS (
  SELECT DISTINCT ON (contact_wa_id)
    contact_wa_id,
    escalation_timestamp,
    handoff_target,
    preferred_contact_slot
  FROM automation.escalations
  WHERE escalation_type = 'business'
  ORDER BY contact_wa_id, escalation_timestamp DESC
)
SELECT
  ca.contact_wa_id,
  ca.display_name,
  ca.last_seen,
  CASE
    WHEN lh.escalation_timestamp >= NOW() - INTERVAL '48 hours' THEN 'high'
    WHEN ca.inbound_last_7d >= 3 AND lh.contact_wa_id IS NULL   THEN 'medium'
    ELSE 'low'
  END AS follow_up_priority
FROM contact_activity ca
LEFT JOIN latest_handoff lh ON lh.contact_wa_id = ca.contact_wa_id
ORDER BY ca.last_seen DESC;

-- Two-way inbox: per-conversation read tracking. Dashboard-side STATE, so it
-- lives in dashboard.* (which dashboard_app owns and may write) — the
-- automation.* read-only invariant is untouched. One row per contact;
-- last_read_log_id is the highest automation.lead_log.id the operator has
-- seen (opening /inbox/[waId] advances it). Unread = inbound rows above it.
CREATE TABLE IF NOT EXISTS dashboard.inbox_read_state (
    contact_wa_id    TEXT PRIMARY KEY,
    last_read_log_id BIGINT NOT NULL DEFAULT 0,
    read_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_by          TEXT NOT NULL DEFAULT ''
);

-- Leads registered by hand: people who called the office, walked in, came
-- from a listing portal or were referred — anyone who did not start on
-- WhatsApp. Dashboard-side state, so it lives in dashboard.* (owned by
-- dashboard_app); automation.* stays read-only. Additive.
--
-- The key is the SAME identifier WhatsApp uses (digits, country code first:
-- 549 + area + number for Argentine mobiles). When that person later writes to
-- the bot, automation.lead_log rows share this contact_wa_id and the CRM reads
-- them as one lead: same card, same history, no merge step.
CREATE TABLE IF NOT EXISTS dashboard.manual_leads (
    contact_wa_id  TEXT PRIMARY KEY,
    display_name   TEXT NOT NULL,
    -- Key from the vertical's crm.manualLeadSources ("portal", "referido"…).
    source         TEXT NOT NULL,
    created_by     TEXT NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

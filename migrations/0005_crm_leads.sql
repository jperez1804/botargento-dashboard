-- CRM-lite: per-lead stage / owner / next step, lead activity history, and the
-- team directory (display name + WhatsApp per allowlisted email). Dashboard-side
-- STATE, so it lives in dashboard.* (owned by dashboard_app) — automation.* and
-- outreach.* stay read-only. Additive: IF NOT EXISTS everywhere, no DROP.
--
-- Automatic stages (nuevo / contactado / calificado / perdido por baja o por
-- inactividad) are DERIVED at read time from automation.* and never persisted:
-- lead_state.stage holds only what a person decided (NULL = no manual stage).
-- See src/lib/crm/effective-stage.ts for the precedence rules.

-- Team directory. One row per allowlisted email that has a display name and/or
-- a WhatsApp number for reminder notifications. Emails without a row are still
-- assignable (the owner picker falls back to the email).
CREATE TABLE IF NOT EXISTS dashboard.team_members (
    email            TEXT PRIMARY KEY
                     REFERENCES dashboard.allowed_emails (email) ON DELETE CASCADE,
    display_name     TEXT NOT NULL DEFAULT '',
    -- E.164 digits without '+'; '' = no WhatsApp reminders for this person.
    whatsapp_number  TEXT NOT NULL DEFAULT '',
    notify_whatsapp  BOOLEAN NOT NULL DEFAULT TRUE,
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by       TEXT NOT NULL DEFAULT ''
);

-- Current state of a lead — one row per contact, overwritten on every change.
-- No FK to automation.* (different schema, owned by n8n).
CREATE TABLE IF NOT EXISTS dashboard.lead_state (
    contact_wa_id            TEXT PRIMARY KEY,
    -- Manual stage key from the vertical config; NULL = derive automatically.
    stage                    TEXT,
    stage_changed_at         TIMESTAMPTZ,
    stage_changed_by         TEXT NOT NULL DEFAULT '',
    lost_reason              TEXT NOT NULL DEFAULT '',
    owner_email              TEXT
                             REFERENCES dashboard.allowed_emails (email) ON DELETE SET NULL,
    owner_assigned_at        TIMESTAMPTZ,
    owner_assigned_by        TEXT NOT NULL DEFAULT '',
    -- "Volver a contactar el día X". notified_at is written by the n8n reminder
    -- workflow; done_at closes the reminder without erasing its note.
    next_action_at           TIMESTAMPTZ,
    next_action_note         TEXT NOT NULL DEFAULT '',
    next_action_set_by       TEXT NOT NULL DEFAULT '',
    next_action_notified_at  TIMESTAMPTZ,
    next_action_done_at      TIMESTAMPTZ,
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_state_owner
    ON dashboard.lead_state (owner_email);
CREATE INDEX IF NOT EXISTS idx_lead_state_open_reminder
    ON dashboard.lead_state (next_action_at)
    WHERE next_action_at IS NOT NULL AND next_action_done_at IS NULL;

-- Append-only history of a lead: notes, calls, visits, meetings, stage changes,
-- assignments, reminders, and 'contact' (a human replied / took over from the
-- inbox). kind has no CHECK on purpose — it is validated against the vertical
-- config so a new vertical can add kinds without a migration.
CREATE TABLE IF NOT EXISTS dashboard.lead_events (
    id             BIGSERIAL PRIMARY KEY,
    contact_wa_id  TEXT NOT NULL,
    kind           TEXT NOT NULL,
    body           TEXT NOT NULL DEFAULT '',
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     TEXT NOT NULL DEFAULT '',
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_lead_events_contact
    ON dashboard.lead_events (contact_wa_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_events_occurred
    ON dashboard.lead_events (occurred_at DESC);

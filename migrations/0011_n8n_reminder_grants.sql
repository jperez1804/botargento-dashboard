-- The CRM reminder notice: n8n reads the due reminders and writes back exactly
-- one column, dashboard.opportunities.next_action_notified_at. Until now that
-- contract lived only in a comment on migration 0005 (lost when 0010 recreated
-- the table) and worked by accident, because n8n connects as the cluster
-- superuser. This migration writes the contract down and makes it enforceable:
-- on a tenant where n8n is NOT superuser the workflow still works, with the
-- narrowest privileges that let it work and nothing more.
--
-- Mirrors the grant block of 0003_outreach_grants.sql: guarded by role
-- existence and wrapped in exception handling, so it is a harmless no-op where
-- the role is named something else, and when re-run from the container as
-- dashboard_app (which owns schema dashboard and may therefore grant on it).
--
-- See docs/crm-oportunidades.md ("Quién escribe qué").

-- 1. The contract, on the column itself, so the next person reads it in psql.
COMMENT ON COLUMN dashboard.opportunities.next_action_notified_at IS
  'When the n8n CRM reminder workflow pushed this reminder to the owner''s WhatsApp. Written ONLY by n8n; the panel clears it to NULL when the reminder is re-scheduled, which re-arms the notice. NULL = never sent.';

COMMENT ON COLUMN dashboard.opportunities.next_action_at IS
  'Volver a contactar el día X. NULL = no reminder.';

-- 2. The narrowest grants the reminder workflow needs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'n8n') THEN
    GRANT USAGE ON SCHEMA dashboard TO n8n;
    -- Read: the due reminders, the person's name, and who to notify.
    GRANT SELECT ON dashboard.opportunities  TO n8n;
    GRANT SELECT ON dashboard.contacts       TO n8n;
    GRANT SELECT ON dashboard.team_members   TO n8n;
    GRANT SELECT ON dashboard.allowed_emails TO n8n;
    -- Write: one column, to record that the notice went out. Nothing else in
    -- dashboard.* is writable by n8n, on purpose.
    GRANT UPDATE (next_action_notified_at) ON dashboard.opportunities TO n8n;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- 3. Existing team WhatsApp numbers: the id the reminder dials.
-- The panel normalizes on save from now on (src/lib/crm/phone.ts, the same
-- helper the manual lead form uses), but rows saved before that kept whatever
-- passed an 8-to-15-digit check, and a 10-digit AR mobile is not dialable on
-- WhatsApp. Only the two unambiguous cases are rewritten; anything else is
-- left exactly as it is rather than guessed at.
UPDATE dashboard.team_members
SET whatsapp_number = '549' || whatsapp_number,
    updated_at = NOW()
WHERE whatsapp_number ~ '^[0-9]{10}$';

UPDATE dashboard.team_members
SET whatsapp_number = '549' || substring(whatsapp_number FROM 3),
    updated_at = NOW()
WHERE whatsapp_number ~ '^54[0-8][0-9]{9}$';

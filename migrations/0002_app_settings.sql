-- Single-row tenant settings table. Backs the /settings page (Phase B) where
-- admins pick --client-primary from a UI picker instead of editing
-- /opt/n8n/<clientN>/dashboard.env. Audited via dashboard.audit_log on every
-- write (action='theme_update').
--
-- The CHECK (id = 1) constraint enforces single-row semantics: there is only
-- ever one settings row per tenant DB. Upserts target id=1 explicitly.
--
-- Migration is additive (CLAUDE.md rule 7) — safe to re-run, never drops.

CREATE TABLE IF NOT EXISTS dashboard.app_settings (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  primary_color text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_by    text NOT NULL
);

-- Seed the row on first run from a bootstrap value. The application layer
-- backfills it from CLIENT_PRIMARY_COLOR on the next request if missing —
-- but seeding here means the dashboard never goes blank between deploy and
-- first manual change. The placeholder is overwritten by getAppSettings()
-- the first time it runs against a tenant whose env has a real color set.
INSERT INTO dashboard.app_settings (id, primary_color, updated_by)
VALUES (1, '#3b82f6', 'migration-0002')
ON CONFLICT (id) DO NOTHING;

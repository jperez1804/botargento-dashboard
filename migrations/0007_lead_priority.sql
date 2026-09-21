-- Manual priority per lead ('' = none; 'alta' | 'media' | 'baja'). A person's
-- decision only — never derived by the bot. Dashboard-side state → dashboard.*.
-- Additive: tenants without the CRM tab carry the empty default unseen.
ALTER TABLE dashboard.lead_state
  ADD COLUMN IF NOT EXISTS priority        TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority_set_by TEXT NOT NULL DEFAULT '';

-- Budget typed by a person; wins over the amount the bot captured. NULL = none
-- (the bot's amount or range shows again). Dashboard-side state → dashboard.*.
-- Additive.
ALTER TABLE dashboard.lead_state
  ADD COLUMN IF NOT EXISTS budget_amount   NUMERIC,
  ADD COLUMN IF NOT EXISTS budget_currency TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS budget_set_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS budget_set_by   TEXT NOT NULL DEFAULT '';

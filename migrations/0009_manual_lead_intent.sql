-- Intent chosen by the person who registers a lead by hand ("Ventas",
-- "Alquileres"…, a key from the vertical's intents). A lead that never wrote
-- on WhatsApp has no lead_log intent, so this is the only place it can come
-- from; once the person writes, the bot's intent wins. '' = none. Additive.
ALTER TABLE dashboard.manual_leads
  ADD COLUMN IF NOT EXISTS intent TEXT NOT NULL DEFAULT '';

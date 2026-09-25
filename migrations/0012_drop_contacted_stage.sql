-- The "Contactado" stage is gone from the real-estate pipeline: an opportunity
-- now goes Nuevo → Calificado, and a reply from the panel is recorded as
-- activity without moving the stage.
--
-- Why it was dropped: since the move to one-person-N-opportunities (0010), an
-- opportunity only exists because the bot handed the person over or because an
-- advisor opened it by hand. A bot-made one always has a handoff in its window,
-- and a handoff outranks a human reply, so it is already Calificado. Contactado
-- was only reachable on a hand-opened opportunity somebody then replied to —
-- and in client1 not one opportunity was ever in it, stored or derived.
--
-- `stage` is plain TEXT with no CHECK (0005), and deriveLead ignores a key the
-- vertical config no longer has, so a leftover row would degrade gracefully
-- rather than break. This still runs, so nothing is left dangling in the column
-- for whoever reads it in psql, and so a tenant that gets the CRM later is
-- covered too.
--
-- NULL, not 'nuevo': nobody decided to put these in Nuevo, so the stage goes
-- back to being derived (which yields Nuevo) instead of carrying a manual pin
-- and a stale stage_changed_at.
UPDATE dashboard.opportunities
SET stage = NULL,
    stage_changed_at = NULL,
    stage_changed_by = '',
    updated_at = NOW()
WHERE stage = 'contactado';

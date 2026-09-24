-- One person, N opportunities.
--
-- Until now a lead WAS the person: dashboard.lead_state had contact_wa_id as
-- its primary key, so somebody who closed a rental and later asked about a
-- sale had nowhere to go — the closed card stayed closed and the new enquiry
-- was invisible. This migration splits the two ideas:
--
--   dashboard.contacts       the person (renamed from manual_leads, now also
--                            holding everyone who wrote to the bot)
--   dashboard.opportunities  one commercial process: stage, owner, priority,
--                            budget, reminder, lost reason — N per person
--
-- dashboard.lead_events gains opportunity_id (NULL = an event about the
-- person, not about one opportunity) and both tables get real foreign keys to
-- contacts, so a lead can never point at somebody who does not exist.
--
-- automation.* stays read-only, and no foreign key can point at
-- automation.lead_log: it belongs to the bot (n8n) and has no unique key per
-- contact. The read-time sync (src/lib/queries/opportunity-sync.ts) is what
-- creates the contact row for everyone who writes.
--
-- Backfilled opportunities get kind = '' unless the person was registered by
-- hand with an intent (PR #28): the raw-intent → rubro mapping lives in
-- TypeScript (src/lib/crm/intent.ts) and cannot run inside a migration. The
-- sync fills those empty kinds from each opportunity's own handoff on the
-- next read.
--
-- Terminal stage keys are spelled out below because SQL cannot read the
-- vertical config; real-estate is the only vertical with a CRM.

-- ── 1. The person ────────────────────────────────────────────────────────────
ALTER TABLE dashboard.manual_leads RENAME TO contacts;

ALTER TABLE dashboard.contacts
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- '' = no name typed by a person; the WhatsApp profile name is used instead.
ALTER TABLE dashboard.contacts ALTER COLUMN display_name SET DEFAULT '';

UPDATE dashboard.contacts SET first_seen_at = created_at WHERE first_seen_at IS NULL;

-- Everyone the dashboard or the bot already knows becomes a contact, so the
-- foreign keys below can be created and the CRM can key on this table alone.
INSERT INTO dashboard.contacts (contact_wa_id, display_name, source, first_seen_at, created_by, created_at)
SELECT p.contact_wa_id,
       '',
       'whatsapp',
       LEAST(msgs.first_seen, ev.first_event),
       '',
       COALESCE(LEAST(msgs.first_seen, ev.first_event), NOW())
FROM (
  SELECT contact_wa_id FROM automation.lead_log WHERE contact_wa_id <> ''
  UNION
  SELECT contact_wa_id FROM dashboard.lead_state
  UNION
  SELECT contact_wa_id FROM dashboard.lead_events
) p
LEFT JOIN LATERAL (
  SELECT MIN(l.log_timestamp) AS first_seen FROM automation.lead_log l
  WHERE l.contact_wa_id = p.contact_wa_id
) msgs ON true
LEFT JOIN LATERAL (
  SELECT MIN(e.occurred_at) AS first_event FROM dashboard.lead_events e
  WHERE e.contact_wa_id = p.contact_wa_id
) ev ON true
ON CONFLICT (contact_wa_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_contacts_source ON dashboard.contacts (source);
CREATE INDEX IF NOT EXISTS idx_contacts_first_seen ON dashboard.contacts (first_seen_at DESC);

-- ── 2. The opportunity ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dashboard.opportunities (
    id                      BIGSERIAL PRIMARY KEY,
    contact_wa_id           TEXT NOT NULL
                            REFERENCES dashboard.contacts (contact_wa_id) ON DELETE CASCADE,
    -- 1, 2, 3… in the order they opened, per person.
    seq                     SMALLINT NOT NULL CHECK (seq > 0),
    -- Vertical intent key ("Ventas", "Alquileres"…). '' = not known yet.
    kind                    TEXT NOT NULL DEFAULT '',
    title                   TEXT NOT NULL DEFAULT '',
    opened_at               TIMESTAMPTZ NOT NULL,
    -- '' = opened automatically by a handoff; otherwise who opened it by hand.
    opened_by               TEXT NOT NULL DEFAULT '',
    -- NULL = open. Set when an advisor moves it to a terminal stage.
    closed_at               TIMESTAMPTZ,

    stage                   TEXT,
    stage_changed_at        TIMESTAMPTZ,
    stage_changed_by        TEXT NOT NULL DEFAULT '',
    lost_reason             TEXT NOT NULL DEFAULT '',

    owner_email             TEXT REFERENCES dashboard.allowed_emails (email) ON DELETE SET NULL,
    owner_assigned_at       TIMESTAMPTZ,
    owner_assigned_by       TEXT NOT NULL DEFAULT '',

    next_action_at          TIMESTAMPTZ,
    next_action_note        TEXT NOT NULL DEFAULT '',
    next_action_set_by      TEXT NOT NULL DEFAULT '',
    next_action_notified_at TIMESTAMPTZ,
    next_action_done_at     TIMESTAMPTZ,

    priority                TEXT NOT NULL DEFAULT '',
    priority_set_at         TIMESTAMPTZ,
    priority_set_by         TEXT NOT NULL DEFAULT '',

    budget_amount           NUMERIC,
    budget_currency         TEXT NOT NULL DEFAULT '',
    budget_set_at           TIMESTAMPTZ,
    budget_set_by           TEXT NOT NULL DEFAULT '',

    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_opportunities_contact_seq
  ON dashboard.opportunities (contact_wa_id, seq);

-- At most ONE automatic open opportunity per person and rubro: this is what
-- makes the read-time sync safe to run concurrently (ON CONFLICT DO NOTHING).
CREATE UNIQUE INDEX IF NOT EXISTS uq_opportunities_auto_open
  ON dashboard.opportunities (contact_wa_id, kind)
  WHERE closed_at IS NULL AND opened_by = '';

CREATE INDEX IF NOT EXISTS idx_opportunities_contact_open
  ON dashboard.opportunities (contact_wa_id, closed_at, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner
  ON dashboard.opportunities (owner_email);
CREATE INDEX IF NOT EXISTS idx_opportunities_open_reminder
  ON dashboard.opportunities (next_action_at)
  WHERE next_action_at IS NOT NULL AND next_action_done_at IS NULL;

-- ── 3. Events belong to a person, and usually to one opportunity ─────────────
ALTER TABLE dashboard.lead_events
  ADD COLUMN IF NOT EXISTS opportunity_id BIGINT
  REFERENCES dashboard.opportunities (id) ON DELETE CASCADE;

ALTER TABLE dashboard.lead_events
  DROP CONSTRAINT IF EXISTS lead_events_contact_fk;
ALTER TABLE dashboard.lead_events
  ADD CONSTRAINT lead_events_contact_fk
  FOREIGN KEY (contact_wa_id) REFERENCES dashboard.contacts (contact_wa_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_lead_events_opportunity
  ON dashboard.lead_events (opportunity_id, occurred_at DESC);

-- ── 4. Backfill: the state the dashboard already held becomes opportunity 1 ──
-- Everyone the dashboard worked on (a lead_state row, an event, or a contact
-- registered by hand). People who only ever wrote to the bot get their
-- opportunities from the sync, one per handoff rubro.
INSERT INTO dashboard.opportunities
  (contact_wa_id, seq, kind, opened_at, opened_by, closed_at,
   stage, stage_changed_at, stage_changed_by, lost_reason,
   owner_email, owner_assigned_at, owner_assigned_by,
   next_action_at, next_action_note, next_action_set_by, next_action_notified_at, next_action_done_at,
   priority, priority_set_at, priority_set_by,
   budget_amount, budget_currency, budget_set_at, budget_set_by, updated_at)
SELECT c.contact_wa_id,
       1,
       COALESCE(NULLIF(c.intent, ''), ''),
       COALESCE(
         LEAST(c.first_seen_at, ev.first_event, s.stage_changed_at, s.owner_assigned_at),
         c.created_at,
         NOW()
       ),
       CASE WHEN c.source = 'whatsapp' THEN '' ELSE COALESCE(c.created_by, '') END,
       CASE WHEN s.stage IN ('cerrado', 'perdido') THEN s.stage_changed_at END,
       s.stage, s.stage_changed_at, COALESCE(s.stage_changed_by, ''), COALESCE(s.lost_reason, ''),
       s.owner_email, s.owner_assigned_at, COALESCE(s.owner_assigned_by, ''),
       s.next_action_at, COALESCE(s.next_action_note, ''), COALESCE(s.next_action_set_by, ''),
       s.next_action_notified_at, s.next_action_done_at,
       COALESCE(s.priority, ''), s.priority_set_at, COALESCE(s.priority_set_by, ''),
       s.budget_amount, COALESCE(s.budget_currency, ''), s.budget_set_at, COALESCE(s.budget_set_by, ''),
       COALESCE(s.updated_at, NOW())
FROM dashboard.contacts c
LEFT JOIN dashboard.lead_state s ON s.contact_wa_id = c.contact_wa_id
LEFT JOIN LATERAL (
  SELECT MIN(e.occurred_at) AS first_event FROM dashboard.lead_events e
  WHERE e.contact_wa_id = c.contact_wa_id
) ev ON true
WHERE s.contact_wa_id IS NOT NULL
   OR ev.first_event IS NOT NULL
   OR c.source <> 'whatsapp';

UPDATE dashboard.lead_events e
SET opportunity_id = o.id
FROM dashboard.opportunities o
WHERE o.contact_wa_id = e.contact_wa_id
  AND o.seq = 1
  AND e.opportunity_id IS NULL;

-- ── 5. The old per-person state is gone ──────────────────────────────────────
DROP TABLE dashboard.lead_state;

-- The rubro of a hand-registered contact now lives on its opportunity.
ALTER TABLE dashboard.contacts DROP COLUMN IF EXISTS intent;

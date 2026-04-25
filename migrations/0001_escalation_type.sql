-- Data-quality fix bundled with v1: separates business escalations from
-- error-handler noise so v_handoff_summary and the Handoffs page show only
-- real human-handoff events.
--
-- Operator-applied at provisioning. v2-error-handler.json writes
-- escalation_type='error' going forward; this migration retroactively tags
-- existing rows whose reason text matches an error pattern.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'automation') THEN
    RAISE NOTICE 'Skipping 0001_escalation_type — automation schema not present (dashboard not yet attached to a tenant runtime).';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'automation' AND table_name = 'escalations'
  ) THEN
    RAISE NOTICE 'Skipping 0001_escalation_type — automation.escalations not present.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE automation.escalations
            ADD COLUMN IF NOT EXISTS escalation_type text NOT NULL DEFAULT ''business''';

  EXECUTE 'UPDATE automation.escalations
            SET escalation_type = ''error''
            WHERE escalation_type = ''business''
              AND reason ILIKE ''%error%''';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping 0001_escalation_type — insufficient privilege (expected when run as dashboard_app).';
END $$;

-- Grant the read-only dashboard role SELECT on the outreach.* schema, for the
-- outbound campaigns tab (features.campaignsTab). Mirrors the automation.* grant
-- block in 0000_init.sql: superuser-only, wrapped in IF EXISTS + exception
-- handling so it is a harmless no-op for tenants without an outreach schema
-- (client1, plec) AND when re-run from the container as dashboard_app.
--
-- "ALL TABLES" includes views; the default-privileges line covers views added
-- later. The dashboard NEVER writes outreach.* — SELECT only.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'outreach') THEN
    GRANT USAGE ON SCHEMA outreach TO dashboard_app;
    GRANT SELECT ON ALL TABLES IN SCHEMA outreach TO dashboard_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA outreach GRANT SELECT ON TABLES TO dashboard_app;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

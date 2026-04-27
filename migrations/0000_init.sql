CREATE SCHEMA IF NOT EXISTS dashboard;

CREATE TABLE IF NOT EXISTS dashboard.allowed_emails (
  email       text PRIMARY KEY,
  role        text NOT NULL DEFAULT 'viewer',
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  text
);

CREATE TABLE IF NOT EXISTS dashboard.magic_link_tokens (
  token_hash   text PRIMARY KEY,
  email        text NOT NULL,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_email
  ON dashboard.magic_link_tokens (email);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_expires_at
  ON dashboard.magic_link_tokens (expires_at);

CREATE TABLE IF NOT EXISTS dashboard.audit_log (
  id          bigserial PRIMARY KEY,
  email       text,
  action      text NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON dashboard.audit_log (created_at DESC);

-- Read-only role for the dashboard app.
-- This block requires superuser privileges. The container runs as
-- `dashboard_app` (which cannot CREATE ROLE), so the operator runs this
-- migration via psql at provisioning time (see Section 12.3 Step C of the
-- blueprint). The container's migrate.mjs is idempotent — re-running this
-- file from the container is a no-op once role + grants are in place.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_app') THEN
    EXECUTE format(
      'CREATE ROLE dashboard_app LOGIN PASSWORD %L',
      coalesce(:'DASHBOARD_APP_PASSWORD', '')
    );
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping CREATE ROLE dashboard_app — current user lacks privilege (expected when run from the dashboard container).';
END $$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO dashboard_app', current_database());
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'automation') THEN
    GRANT USAGE ON SCHEMA automation TO dashboard_app;
    GRANT SELECT ON ALL TABLES IN SCHEMA automation TO dashboard_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA automation GRANT SELECT ON TABLES TO dashboard_app;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  GRANT USAGE, CREATE ON SCHEMA dashboard TO dashboard_app;
  GRANT ALL ON ALL TABLES IN SCHEMA dashboard TO dashboard_app;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA dashboard TO dashboard_app;
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

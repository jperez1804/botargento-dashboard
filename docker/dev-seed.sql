-- Initial dev DB seed runs once on first container boot via
-- /docker-entrypoint-initdb.d. Real schema/data come from the dashboard's
-- own migrations + scripts/seed-dev.ts; this file just sets up the schemas
-- so those run cleanly.

CREATE SCHEMA IF NOT EXISTS automation;
CREATE SCHEMA IF NOT EXISTS dashboard;

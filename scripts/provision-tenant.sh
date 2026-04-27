#!/usr/bin/env bash
# Per-tenant first-time provisioning.
#
# Run on the VPS as the `deploy` user with the dashboard repo cloned at
# /opt/n8n/_dashboard-checkout (or wherever — the script just needs access to
# the migrations/ files; it falls back to GitHub raw if missing).
#
# Usage:
#   ./scripts/provision-tenant.sh <clientN>
#
# Idempotent-ish: re-running on a tenant that's already provisioned will skip
# the steps that have already been done (per the in-DB __migrations table)
# and prompt before overwriting compose / env files.

set -euo pipefail

# ---------------------------------------------------------------------------
# Args + sanity
# ---------------------------------------------------------------------------

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <clientN>"
  exit 2
fi

TENANT="$1"
TENANT_ROOT="/opt/n8n/$TENANT"
TENANT_ENV="$TENANT_ROOT/.env"
N8N_POSTGRES_CONTAINER="n8n-$TENANT-postgres"
DASHBOARD_CONTAINER="n8n-$TENANT-dashboard"
DASHBOARD_IMAGE_REPO="${DASHBOARD_IMAGE_REPO:-ghcr.io/jperez1804/dashboard}"
RAW_BASE_URL="${RAW_BASE_URL:-https://raw.githubusercontent.com/jperez1804/botargento-dashboard/main}"
COMPOSE_CMD=()

if [[ ! -d "$TENANT_ROOT" ]]; then
  echo "✗ $TENANT_ROOT does not exist."
  echo "  This script provisions the dashboard for an *existing* tenant — n8n + Postgres must already be running."
  exit 1
fi

detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
    return
  fi
  if docker-compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
    return
  fi

  echo "✗ Neither 'docker compose' nor 'docker-compose' is available."
  exit 1
}

run_compose() {
  (
    cd "$TENANT_ROOT"
    set -a
    # shellcheck disable=SC1091
    source "$ENV_FILE"
    set +a
    "${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" "$@"
  )
}
if [[ ! -f "$TENANT_ENV" ]]; then
  echo "✗ $TENANT_ENV missing — can't read POSTGRES_USER / POSTGRES_DB"
  exit 1
fi
if ! docker ps --format '{{.Names}}' | grep -q "^${N8N_POSTGRES_CONTAINER}$"; then
  echo "✗ Postgres container '$N8N_POSTGRES_CONTAINER' is not running."
  exit 1
fi

# ---------------------------------------------------------------------------
# Source tenant config
# ---------------------------------------------------------------------------

set -a
# shellcheck disable=SC1090
source "$TENANT_ENV"
set +a

: "${POSTGRES_USER:?POSTGRES_USER missing in $TENANT_ENV}"
: "${POSTGRES_DB:?POSTGRES_DB missing in $TENANT_ENV}"
: "${TZ:=America/Argentina/Buenos_Aires}"

echo "→ Tenant: $TENANT"
echo "  Postgres container: $N8N_POSTGRES_CONTAINER"
echo "  Postgres DB:        $POSTGRES_DB (user $POSTGRES_USER)"
echo "  Timezone:           $TZ"

# ---------------------------------------------------------------------------
# Pre-flight: required automation views
# ---------------------------------------------------------------------------

echo
echo "→ Pre-flight: verifying automation.v_* views exist…"
MISSING_VIEWS=$(docker exec -i "$N8N_POSTGRES_CONTAINER" \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c "
    SELECT name FROM (VALUES
      ('v_daily_metrics'),('v_flow_breakdown'),
      ('v_contact_summary'),('v_handoff_summary'),
      ('v_follow_up_queue')) AS req(name)
    WHERE name NOT IN (
      SELECT table_name FROM information_schema.views
      WHERE table_schema='automation'
    );")

if [[ -n "$MISSING_VIEWS" ]]; then
  echo "✗ Missing views:"
  echo "$MISSING_VIEWS" | sed 's/^/    automation./'
  echo "  Apply postgres-setup.sql from whatsapp-automation-claude first."
  exit 1
fi
echo "✓ All 5 required views present."

# ---------------------------------------------------------------------------
# Operator inputs
# ---------------------------------------------------------------------------

read -rp $'\n→ CLIENT_NAME (legal/display name): ' CLIENT_NAME
[[ -n "$CLIENT_NAME" ]] || { echo "✗ CLIENT_NAME is required"; exit 1; }

read -rp "→ CLIENT_PRIMARY_COLOR [#3b82f6]: " CLIENT_PRIMARY_COLOR
CLIENT_PRIMARY_COLOR="${CLIENT_PRIMARY_COLOR:-#3b82f6}"
if ! [[ "$CLIENT_PRIMARY_COLOR" =~ ^#[0-9a-fA-F]{3,8}$ ]]; then
  echo "✗ Color must be a hex like #4a7ec4"; exit 1
fi

read -rp "→ AUTH_EMAIL_FROM [no-reply@botargento.com.ar]: " AUTH_EMAIL_FROM
AUTH_EMAIL_FROM="${AUTH_EMAIL_FROM:-no-reply@botargento.com.ar}"

read -rp "→ RESEND_API_KEY: " RESEND_API_KEY
[[ -n "$RESEND_API_KEY" ]] || { echo "✗ RESEND_API_KEY is required"; exit 1; }

echo
echo "→ Initial allowlist emails (one per line, blank line to finish):"
ALLOWLIST=()
while true; do
  read -rp "    > " EMAIL
  [[ -z "$EMAIL" ]] && break
  if [[ ! "$EMAIL" =~ ^[^@]+@[^@]+\.[^@]+$ ]]; then
    echo "    ✗ '$EMAIL' is not a valid email — skipping"
    continue
  fi
  ALLOWLIST+=("$EMAIL")
done
[[ ${#ALLOWLIST[@]} -gt 0 ]] || { echo "✗ at least one email required"; exit 1; }

# ---------------------------------------------------------------------------
# DB migrations + role
# ---------------------------------------------------------------------------

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/migrations"
if [[ ! -f "$MIGRATIONS_DIR/0000_init.sql" ]]; then
  echo "→ Local migrations not found — fetching from GitHub raw…"
  MIGRATIONS_DIR="$(mktemp -d)"
  curl -fsSL "$RAW_BASE_URL/migrations/0000_init.sql" \
    -o "$MIGRATIONS_DIR/0000_init.sql"
  curl -fsSL "$RAW_BASE_URL/migrations/0001_escalation_type.sql" \
    -o "$MIGRATIONS_DIR/0001_escalation_type.sql"
fi

DASHBOARD_APP_PASSWORD=$(openssl rand -hex 24)
AUTH_SECRET=$(openssl rand -hex 32)

echo
echo "→ Applying migrations/0000_init.sql (creates dashboard schema + role)…"
TMP_0000="$(mktemp)"
sed "s/:'DASHBOARD_APP_PASSWORD'/'$DASHBOARD_APP_PASSWORD'/g" \
  "$MIGRATIONS_DIR/0000_init.sql" > "$TMP_0000"
docker exec -i "$N8N_POSTGRES_CONTAINER" \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
       -v ON_ERROR_STOP=1 \
  < "$TMP_0000"
rm -f "$TMP_0000"

echo "→ Applying migrations/0001_escalation_type.sql…"
docker exec -i "$N8N_POSTGRES_CONTAINER" \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
       -v ON_ERROR_STOP=1 \
  < "$MIGRATIONS_DIR/0001_escalation_type.sql"

echo "→ Seeding allowlist (${#ALLOWLIST[@]} email(s))…"
{
  echo "INSERT INTO dashboard.allowed_emails (email, role, created_by) VALUES"
  first=1
  for e in "${ALLOWLIST[@]}"; do
    sep=$([[ $first -eq 1 ]] && echo "" || echo ",")
    first=0
    printf "%s ('%s', 'viewer', 'provision-tenant.sh')" "$sep" "$(echo "$e" | tr '[:upper:]' '[:lower:]')"
    echo
  done
  echo "ON CONFLICT (email) DO NOTHING;"
} | docker exec -i "$N8N_POSTGRES_CONTAINER" \
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1

# ---------------------------------------------------------------------------
# Network discovery (compose project prefix)
# ---------------------------------------------------------------------------

INTERNAL_NETWORK=$(docker network ls --format '{{.Name}}' | grep -E "(^${TENANT}_${TENANT}-internal\$|^${TENANT}-internal\$)" | head -n1)
if [[ -z "$INTERNAL_NETWORK" ]]; then
  echo "✗ Could not auto-detect tenant-internal network. Check 'docker network ls' for one matching '$TENANT'."
  exit 1
fi
echo "✓ tenant-internal network: $INTERNAL_NETWORK"

# ---------------------------------------------------------------------------
# Compose + env
# ---------------------------------------------------------------------------

COMPOSE_FILE="$TENANT_ROOT/dashboard.compose.yml"
ENV_FILE="$TENANT_ROOT/dashboard.env"

if [[ -e "$COMPOSE_FILE" ]]; then
  read -rp "⚠  $COMPOSE_FILE exists. Overwrite? [y/N] " yn
  [[ "$yn" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

mkdir -p "$TENANT_ROOT/assets"

cat > "$COMPOSE_FILE" <<YAML
services:
  dashboard:
    image: ${DASHBOARD_IMAGE_REPO}:\${DASHBOARD_TAG:-latest}
    container_name: ${DASHBOARD_CONTAINER}
    restart: unless-stopped
    expose:
      - "3000"
    environment:
      TENANT_DB_URL: "postgres://dashboard_app:\${DASHBOARD_APP_PASSWORD}@postgres:5432/\${POSTGRES_DB}"
      VERTICAL: real-estate
      CLIENT_NAME: "${CLIENT_NAME}"
      CLIENT_LOGO_URL: "/logos/client.svg"
      CLIENT_PRIMARY_COLOR: "${CLIENT_PRIMARY_COLOR}"
      CLIENT_TIMEZONE: "\${TZ}"
      CLIENT_LOCALE: "es-AR"
      AUTH_SECRET: "\${AUTH_SECRET}"
      AUTH_URL: "https://dashboard.${TENANT}.botargento.com.ar"
      AUTH_EMAIL_FROM: "${AUTH_EMAIL_FROM}"
      RESEND_API_KEY: "\${RESEND_API_KEY}"
      TZ: "\${TZ}"
      NODE_ENV: production
      LOG_LEVEL: info
    volumes:
      - ${TENANT_ROOT}/assets/logo.svg:/app/public/logos/client.svg:ro
    networks:
      - tenant-internal
      - traefik-public
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=traefik-public"
      - "traefik.http.routers.dashboard-${TENANT}.rule=Host(\`dashboard.${TENANT}.botargento.com.ar\`)"
      - "traefik.http.routers.dashboard-${TENANT}.entrypoints=websecure"
      - "traefik.http.routers.dashboard-${TENANT}.tls=true"
      - "traefik.http.routers.dashboard-${TENANT}.tls.certresolver=letsencrypt"
      - "traefik.http.routers.dashboard-${TENANT}.service=dashboard-${TENANT}"
      - "traefik.http.services.dashboard-${TENANT}.loadbalancer.server.port=3000"

networks:
  tenant-internal:
    external: true
    name: ${INTERNAL_NETWORK}
  traefik-public:
    external: true
    name: traefik-public
YAML

cat > "$ENV_FILE" <<EOF
# Reused from the existing tenant .env (must match)
POSTGRES_DB=${POSTGRES_DB}
TZ=${TZ}

# Dashboard-only
DASHBOARD_APP_PASSWORD=${DASHBOARD_APP_PASSWORD}
AUTH_SECRET=${AUTH_SECRET}
RESEND_API_KEY=${RESEND_API_KEY}
DASHBOARD_TAG=latest
EOF
chmod 0600 "$ENV_FILE"

echo "✓ Wrote $COMPOSE_FILE"
echo "✓ Wrote $ENV_FILE (mode 0600)"

# ---------------------------------------------------------------------------
# Logo + DNS reminders
# ---------------------------------------------------------------------------

if [[ ! -f "$TENANT_ROOT/assets/logo.svg" ]]; then
  echo
  echo "⚠  No logo at $TENANT_ROOT/assets/logo.svg yet."
  echo "   Drop the client's logo there *before* the container starts, or"
  echo "   it'll fail to mount. The container will retry on every restart."
  read -rp "   Press enter once the logo is in place… "
fi

# ---------------------------------------------------------------------------
# Launch
# ---------------------------------------------------------------------------

echo
echo "→ Pulling latest image and starting container…"
detect_compose
run_compose pull dashboard
run_compose up -d dashboard

# Wait for the container to settle
for i in $(seq 1 30); do
  status=$(docker inspect "$DASHBOARD_CONTAINER" --format '{{.State.Status}}' 2>/dev/null || echo "missing")
  if [[ "$status" == "running" ]]; then
    echo "✓ $DASHBOARD_CONTAINER is running"
    break
  fi
  sleep 1
  if [[ "$i" -eq 30 ]]; then
    echo "✗ $DASHBOARD_CONTAINER did not reach 'running' after 30s (last status: $status)"
    docker logs --tail 50 "$DASHBOARD_CONTAINER" || true
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# Update /opt/scripts/tenants.txt
# ---------------------------------------------------------------------------

if [[ -w /opt/scripts/tenants.txt ]]; then
  if ! grep -qx "$TENANT" /opt/scripts/tenants.txt 2>/dev/null; then
    echo "$TENANT" >> /opt/scripts/tenants.txt
    sort -u /opt/scripts/tenants.txt -o /opt/scripts/tenants.txt
    echo "✓ Added $TENANT to /opt/scripts/tenants.txt"
  fi
else
  echo "ℹ  /opt/scripts/tenants.txt not writable — add '$TENANT' there manually so 'all' deploys include it."
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

cat <<DONE

================================================================
✓ Provisioning complete

  Dashboard URL:  https://dashboard.${TENANT}.botargento.com.ar

  DNS reminder:   add a CNAME for dashboard.${TENANT} → VPS
                  hostname (TTL 300) if you haven't already.

  Allowlisted:    ${#ALLOWLIST[@]} email(s).
                  Add more later via:
                  docker exec -i ${N8N_POSTGRES_CONTAINER} \\
                    psql -U postgres -d ${POSTGRES_DB} \\
                    -c "INSERT INTO dashboard.allowed_emails …"

  Logs:           docker logs -f ${DASHBOARD_CONTAINER}

  Smoke test:     curl -sI https://dashboard.${TENANT}.botargento.com.ar
================================================================
DONE

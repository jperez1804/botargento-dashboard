#!/usr/bin/env bash
# Lives at /opt/scripts/update-dashboards.sh on the VPS. Driven by the
# `Deploy` GitHub workflow but also runnable by hand for emergency ops.
#
# Usage:
#   update-dashboards.sh <tenant|all> <tag>
#
# - <tenant>: a directory name under /opt/n8n/ (e.g. client1) or the literal "all"
# - <tag>:    a Docker image tag — typically a commit SHA for rollback, or "latest"
#
# Each tenant has /opt/n8n/<t>/dashboard.compose.yml + dashboard.env. We pin
# the tag in the env file so a docker compose restart sticks to that version.

set -euo pipefail

TENANT_FILTER="${1:-all}"
TAG="${2:-latest}"
TENANT_ROOT="/opt/n8n"
REGISTRY="/opt/scripts/tenants.txt"
COMPOSE_CMD=()

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

if [[ "$TENANT_FILTER" == "all" ]]; then
  if [[ ! -f "$REGISTRY" ]]; then
    echo "✗ $REGISTRY not found — populate it with one tenant directory name per line"
    exit 1
  fi
  TENANTS=$(cat "$REGISTRY")
else
  TENANTS="$TENANT_FILTER"
fi

detect_compose

for t in $TENANTS; do
  COMPOSE_FILE="$TENANT_ROOT/$t/dashboard.compose.yml"
  ENV_FILE="$TENANT_ROOT/$t/dashboard.env"

  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "⚠  $t has no dashboard.compose.yml — skipping"
    continue
  fi
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "⚠  $t has no dashboard.env — skipping"
    continue
  fi

  CONTAINER="n8n-$t-dashboard"
  echo "→ Updating $CONTAINER to tag '$TAG'"

  # Pin the tag in the env file so a host reboot brings up the right version
  if grep -q '^DASHBOARD_TAG=' "$ENV_FILE"; then
    sed -i "s/^DASHBOARD_TAG=.*/DASHBOARD_TAG=$TAG/" "$ENV_FILE"
  else
    echo "DASHBOARD_TAG=$TAG" >> "$ENV_FILE"
  fi

  cd "$TENANT_ROOT/$t"
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  set +a
  "${COMPOSE_CMD[@]}" -f dashboard.compose.yml pull dashboard
  "${COMPOSE_CMD[@]}" -f dashboard.compose.yml up -d dashboard

  # Wait up to 30s for the new container to settle
  for i in $(seq 1 30); do
    status=$(docker inspect "$CONTAINER" --format '{{.State.Status}}' 2>/dev/null || echo "missing")
    if [[ "$status" == "running" ]]; then
      echo "✓ $CONTAINER is running ($i s)"
      break
    fi
    sleep 1
    if [[ "$i" -eq 30 ]]; then
      echo "✗ $CONTAINER did not reach 'running' after 30s (last status: $status)"
      docker logs --tail 50 "$CONTAINER" || true
      exit 1
    fi
  done
done

echo "✓ All done"

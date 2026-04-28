#!/bin/sh
set -e

# Wait up to 60s for Postgres to be reachable. client1-internal is an internal
# network, so a cold boot where both containers start simultaneously can race.
echo "→ Waiting for Postgres..."
for i in $(seq 1 60); do
  if node -e "require('postgres')(process.env.TENANT_DB_URL, { connect_timeout: 2 })\`SELECT 1\`.then(()=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "✓ Postgres reachable"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "✗ Postgres not reachable after 60s — check TENANT_DB_URL and network attachment"
    exit 1
  fi
  sleep 1
done

echo "→ Applying pending migrations to tenant DB..."
node scripts/migrate.mjs

echo "→ Verifying automation.v_* views exist..."
node scripts/verify-view-compat.mjs

# Next.js standalone server reads HOSTNAME/PORT when booting `server.js`.
# In Docker, HOSTNAME defaults to the container id and can resolve to only one
# attached network, which breaks Traefik on multi-network tenants.
export HOSTNAME=0.0.0.0
export PORT="${PORT:-3000}"

exec "$@"

#!/usr/bin/env bash
set -euo pipefail

LOG=".playwright-dev-server.log"
export NEXT_TELEMETRY_DISABLED=1

# Drop any existing dev server on port 3000 so we own the process tree
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti:3000 || true)
  if [ -n "$PIDS" ]; then kill -9 $PIDS || true; fi
fi

echo "→ starting dev server (log: $LOG)"
: > "$LOG"
pnpm dev > "$LOG" 2>&1 &
DEV_PID=$!
trap 'kill $DEV_PID 2>/dev/null || true' EXIT

# Wait until /login responds (dev server is alive)
for i in $(seq 1 60); do
  if curl -sf -o /dev/null http://localhost:3000/login; then
    echo "✓ dev server up"
    break
  fi
  sleep 1
  if [ "$i" -eq 60 ]; then
    echo "✗ dev server did not respond on /login within 60s"
    tail -n 100 "$LOG" || true
    exit 1
  fi
done

# Warm the proxy: hit a protected route so Next compiles proxy.ts before
# Playwright's first test races with on-demand compilation. We expect a 307
# redirect to /login — anything else means the proxy isn't wired up.
echo "→ warming proxy on /"
for i in $(seq 1 30); do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ || echo "000")
  if [ "$STATUS" = "307" ] || [ "$STATUS" = "302" ]; then
    echo "✓ proxy redirects unauthenticated / (HTTP $STATUS)"
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "✗ proxy did not redirect / after 30s (last status: $STATUS)"
    tail -n 100 "$LOG" || true
    exit 1
  fi
done

pnpm exec playwright test "$@"

#!/usr/bin/env bash
set -euo pipefail

LOG=".playwright-dev-server.log"

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

# Wait until the dev server is responsive
for i in $(seq 1 60); do
  if curl -sf -o /dev/null http://localhost:3000/login; then
    echo "✓ dev server up"
    break
  fi
  sleep 1
done

pnpm exec playwright test "$@"

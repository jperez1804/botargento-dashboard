# botargento-dashboard

Client-facing analytics dashboard for BotArgento WhatsApp-automation tenants.
One container per tenant at `dashboard.<clientN>.botargento.com.ar`.

This README is operator-facing — local dev, provisioning, deploys, and
troubleshooting. The architectural blueprint lives in
[`docs/BLUEPRINT.md`](docs/BLUEPRINT.md). Project rules + design system live
in [`CLAUDE.md`](CLAUDE.md).

---

## Quick reference

| Need | Command |
|---|---|
| Run dev server | `pnpm dev` |
| Run unit tests | `pnpm test` |
| Run E2E tests | `pnpm test:e2e` (needs Docker for the dev DB) |
| Type check | `pnpm exec tsc --noEmit` |
| Apply migrations | `pnpm db:migrate` |
| Seed dev DB | `pnpm db:seed:dev` |
| Verify required views | `pnpm db:verify-views` |
| Provision a new tenant | `./scripts/provision-tenant.sh client3` (run on the VPS) |
| Roll out an update | GitHub Actions → **Deploy** → tenant=`all`, tag=`latest` |

---

## Local development

### Prerequisites
- Node 20 LTS (see `.nvmrc`)
- pnpm 9+
- Docker 24+ with Compose v2
- A Resend account (the dev short-circuit logs the magic-link URL to the
  terminal, so a real key isn't required)

### One-time setup
```bash
git clone https://github.com/jperez1804/botargento-dashboard.git botargento-dashboard
cd botargento-dashboard
pnpm install

cp .env.example .env.local

docker compose -f docker/docker-compose.dev.yml up -d
pnpm db:migrate
pnpm db:seed:dev

pnpm dev
```

Open `http://localhost:3000`. Submit `dev@botargento.com.ar` (seeded by
`db:seed:dev`) on the login form. The magic-link URL prints to the dev
server's stdout; click it to land on the dashboard.

### Layout

```
src/
├── app/(auth)/        Public routes: login, verify
├── app/(dashboard)/   Protected routes: overview, conversations, handoffs, follow-up
├── app/api/           Auth callback + CSV export route handlers
├── components/        dashboard/* visual components, layout/* shell, ui/* shadcn
├── config/            tenant.ts (env-derived) + verticals/* (vertical configs)
├── db/                Drizzle schema + postgres.js client + view wrappers
├── lib/               auth, queries/, csv, date, env, format, logger, rate-limit
├── proxy.ts           Next 16 proxy: guards (dashboard)/* + /api/export/*
└── ...
```

All SQL goes through `src/lib/queries/*.ts`. All env vars go through
`src/lib/env.ts`. All UI labels come from `verticalConfig` or `tenantConfig`.
See [`CLAUDE.md`](CLAUDE.md) for the non-negotiable rules.

### Dev database details
The dev compose brings up Postgres 16 on host port `5433` with database
`dashboard_dev`. The seed script (`scripts/seed-dev.ts`) creates a synthetic
`automation.*` schema (the upstream views the production tenant Postgres
provides) and inserts 14 days of fake activity plus stale leads to populate
the follow-up queue with all three priorities.

To reset:
```bash
docker compose -f docker/docker-compose.dev.yml down -v
docker compose -f docker/docker-compose.dev.yml up -d
pnpm db:migrate && pnpm db:seed:dev
```

---

## Provisioning a new tenant

Per blueprint Section 12.3, every new client follows the same runbook.
Target: ≤ 15 minutes of operator time.

The interactive helper does most of the work:

```bash
# On the VPS, as the deploy user
sudo -u deploy bash
cd /opt/n8n  # the existing tenant root
./scripts/provision-tenant.sh client3
```

The script will prompt for:
- `CLIENT_NAME` (legal/display name)
- `CLIENT_PRIMARY_COLOR` (hex)
- `AUTH_EMAIL_FROM` and `RESEND_API_KEY`
- Initial allowlist emails (one per line, blank to finish)

It then:
1. Verifies the tenant's Postgres + automation views exist
2. Generates a strong `dashboard_app` password and `AUTH_SECRET`
3. Applies `migrations/0000_init.sql` and `migrations/0001_escalation_type.sql`
4. Seeds the allowlist
5. Auto-detects the tenant-internal Docker network (handles compose project prefix)
6. Writes `dashboard.compose.yml` + `dashboard.env` next to the existing n8n compose
7. Pulls the latest image and brings up the container
8. Updates `/opt/scripts/tenants.txt` so future `Deploy` runs include it

Two manual prerequisites the script can't automate:
- **DNS:** in Donweb, add `dashboard.<clientN>` as a CNAME pointing at the VPS hostname (TTL 300)
- **Logo:** drop the SVG at `/opt/n8n/<clientN>/assets/logo.svg` before launching

Both are reminded by the script.

---

## Deploys

Production deploy is two steps:

1. Merge to `main` → `Release` workflow builds and pushes
   `ghcr.io/<owner>/dashboard:<sha>` and `:latest`.
2. **Actions → Deploy → Run workflow.** Inputs:
   - `tenant`: `all` or a specific directory name (e.g. `client1`)
   - `tag`: `latest` (track main) or a specific SHA (rollback / pinning)

The Deploy job SSHes to the VPS and runs
`/opt/scripts/update-dashboards.sh`, which:
- Reads `/opt/scripts/tenants.txt` for the `all` case
- Pins `DASHBOARD_TAG` in each tenant's `dashboard.env`
- Pulls the image, restarts the container, waits up to 30 s for `running`

**Rollback:** trigger the same workflow with `tag=<previous-good-sha>`. ~2 min
round-trip across all tenants.

There is no staging in v1. Validate by deploying to a single canary tenant
first if a change is risky.

---

## Operating concerns

### Allowlist management
```bash
docker exec -i n8n-<clientN>-postgres \
  psql -U postgres -d <dbname> <<SQL
INSERT INTO dashboard.allowed_emails (email, role, created_by)
VALUES ('new-user@cliente.com', 'viewer', 'jonatan')
ON CONFLICT (email) DO NOTHING;
SQL
```

To revoke access:
```bash
docker exec -i n8n-<clientN>-postgres \
  psql -U postgres -d <dbname> \
  -c "DELETE FROM dashboard.allowed_emails WHERE email = 'former-user@cliente.com';"
```

In-flight magic links are invalidated automatically — `useVerificationToken`
re-checks allowlist membership on every verify.

### Audit log
Every login, denied attempt, and CSV export lands in `dashboard.audit_log`.
For a quick incident review:
```bash
docker exec -i n8n-<clientN>-postgres psql -U postgres -d <dbname> \
  -c "SELECT created_at, email, action, metadata
        FROM dashboard.audit_log
        ORDER BY created_at DESC LIMIT 50;"
```

### Logs
```bash
docker logs -f n8n-<clientN>-dashboard
```

The app uses pino. In production, JSON-structured to stdout — pipe to your
log aggregator if needed.

### Health
The dashboard relies on `automation.v_*` views. If a tenant's reporting
pipeline drifts:
```bash
docker exec n8n-<clientN>-dashboard \
  node scripts/verify-view-compat.mjs
```

The container's entrypoint runs this on every boot — if it fails, the
container exits with a clear list of missing views.

---

## Troubleshooting

| Symptom | Most likely cause | Fix |
|---|---|---|
| Container restarts in a loop with `Missing required views` | Tenant Postgres has no `automation` schema | Run `postgres-setup.sql` from `whatsapp-automation-claude` |
| Login form submits but no email arrives | Email not in `dashboard.allowed_emails` | Add it (see Allowlist management) |
| Email arrives but link goes to "AccessDenied" | Email was removed mid-flight, or token expired (>15 min) | Request a new link |
| `network ..._..._-internal declared as external, but could not be found` | Compose project prefix mismatch | `docker network ls \| grep <clientN>` and update `name:` in `dashboard.compose.yml` |
| Charts show zeros despite known activity | View tz drift or wrong `CLIENT_TIMEZONE` | Compare `SELECT day FROM automation.v_daily_metrics` against `CLIENT_TIMEZONE` in env |
| 429 on CSV export | 10/minute/session rate limit | Wait a minute; `src/lib/rate-limit.ts` if you need to adjust |
| Refresh button does nothing | Browser cached aggressively | Force-reload (Ctrl+Shift+R); the route response is `Cache-Control: no-store` |

---

## Reglas no negociables (resumen)

1. The dashboard never writes to `automation.*` — `dashboard_app` has SELECT only.
2. No hardcoded Spanish strings in JSX. Labels live in `verticalConfig` / `tenantConfig`.
3. No `process.env.X` in feature code. Read through `env()`.
4. Every page query is in a Server Component. No client-side data fetching.
5. Every auth-relevant action lands in `dashboard.audit_log`.
6. Magic-link tokens are SHA-256 hashed before storage.
7. Migrations are additive only.
8. Max 300 lines per component file.
9. Env vars are Zod-validated at boot — fail fast, not at request time.
10. No secrets in Git. They live in `/opt/n8n/<clientN>/dashboard.env` (mode 0600) on the VPS.

Full version with rationale in [`CLAUDE.md`](CLAUDE.md).

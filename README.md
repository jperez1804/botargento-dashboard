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
| Run E2E tests | `TENANT_DB_URL=… pnpm test:e2e` (needs Docker for the dev DB) |
| Type check | `pnpm exec tsc --noEmit` |
| Apply migrations | `pnpm db:migrate` |
| Seed dev DB | `pnpm db:seed:dev` |
| Verify required views | `pnpm db:verify-views` |
| Provision a new tenant | `cd /home/deploy/_dashboard-checkout && bash ./scripts/provision-tenant.sh client3` (run on the VPS as `deploy`) |
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

### Overview surfaces (intent KPIs)

The overview page (`/`) now layers per-intent analytics on top of the volume
KPIs. Design rationale and tuning guidance live in
[`docs/INTENT_KPIS_PLAN.md`](docs/INTENT_KPIS_PLAN.md).

| Surface | What it answers |
|---|---|
| KPI strip | Inbound · outbound · contactos únicos · tasa de derivación · **Intención líder** (top bucket + Δ) · **Resueltas por el bot** (% sin handoff) |
| `Contactos por intención` | Unique contacts per intent, with per-bucket Δ vs prior 7d, per-intent **handoff-rate chips** colored against `desiredHandoffRate`, and an attribution disclaimer |
| `Volumen por intención` | Flow-step volume per intent (chatbot load), with Δ chips and **Interacciones por contacto** (engagement density) |
| `Top valores en Otras` | Collapsed `<details>` listing raw tokens that fell into Otras — feeds the labeling backlog |
| `Demanda por hora` | 7×24 heatmap, **default 28-day window** (independent from the 7d page filter), filterable by intent via `?heatmapIntent=` |
| `Finalización de flujos` | Per-intent completion rate based on `terminalIntents` config; renders `—` for buckets without configured terminals |
| `Tiempo hasta derivación` | Per-intent median + p90; `—` when `n < 5`; wall-clock disclaimer |

### Tuning the per-intent thresholds

The chip coloring and completion logic read from `src/config/verticals/<vertical>.ts`:

- `desiredHandoffRate` (0..1) per intent — green when actual is at/above target ± 10% tolerance, red when below, gray when undefined.
- `terminalIntents: string[]` per intent — raw automation tokens that mark the end of the flow. Omit when no clear terminal exists; the strip will render `—`.

After tuning, no DB migration or rebuild is needed beyond a redeploy.

### Shareable URL state

These query params survive reload and copy/paste:

- `?touch=last|first|any` — attribution mode for `Contactos por intención`.
  - `last` (default): each contact lands in exactly one bucket — their last inbound business intent. Per-intent counts sum to *unique contacts whose last inbound intent was a business intent*, which is **less than or equal to** the global `Contactos únicos` KPI: contacts whose last inbound was the `menu` token (navigation only, no engagement) are dropped from the chart but still counted globally.
  - `first`: same shape as `last`, but the FIRST inbound intent. Useful for "what did the customer originally ask about?".
  - `any`: legacy multi-intent view — a contact who moved Ventas → Tasaciones counts in BOTH buckets. Sums exceed unique contacts; the chart's summary line warns about this.
- `?heatmapIntent=<bucket label>` — filters the heatmap to a single intent (`Ventas`, `Alquileres`, `Tasaciones`, `Emprendimientos`, `Administracion`, `Otras`).

### Dev database details
The dev compose brings up Postgres 16 on host port `5433` with database
`dashboard_dev`. The seed script (`scripts/seed-dev.ts`) recreates the
`automation.*` schema from `scripts/dev-automation-setup.sql` (mirrors the
production tenant views) and inserts 14 days of fake activity plus stale leads
to populate the follow-up queue with all three priorities.

The seed `DROP SCHEMA automation CASCADE`s before re-applying setup, so
re-running `pnpm db:seed:dev` always brings a drifted dev DB forward — no
manual reset needed when columns/views change.

`pnpm test:e2e` requires `TENANT_DB_URL` exported in the shell (the helpers
run outside Next, so `.env.local` isn't picked up automatically):

```bash
TENANT_DB_URL='postgres://postgres:devpass@localhost:5433/dashboard_dev' pnpm test:e2e
```

To wipe the volume entirely:
```bash
docker compose -f docker/docker-compose.dev.yml down -v
docker compose -f docker/docker-compose.dev.yml up -d
pnpm db:migrate && pnpm db:seed:dev
```

---

## VPS prerequisites (one-time, global)

Before the first tenant install, make sure the VPS already satisfies the shared
deployment assumptions this repo and the GitHub workflows rely on.

### 1. Existing tenant stack

For each `clientN` you want a dashboard for, you already need:
- `/opt/n8n/<clientN>/` with the existing n8n stack
- `/opt/n8n/<clientN>/.env` containing at least `POSTGRES_USER`, `POSTGRES_DB`, and `TZ`
- a running Postgres container named `n8n-<clientN>-postgres`
- the `automation.*` reporting views:
  `v_daily_metrics`, `v_flow_breakdown`, `v_contact_summary`,
  `v_handoff_summary`, `v_follow_up_queue`

The provisioner fails fast if those views do not exist.

### 2. Traefik conventions

The generated compose expects the same Traefik wiring used by the existing
tenant stack:
- shared external network named `traefik-public`
- TLS cert resolver named `letsencrypt`
- `websecure` entrypoint handling HTTPS traffic

Those names are not placeholders. The generated labels pin them literally.

### 3. `deploy` user and Docker access

The GitHub `Deploy` workflow SSHes as `deploy`, so that user must exist on the
VPS and be able to talk to Docker. A typical bootstrap looks like:

```bash
# as root
adduser deploy
usermod -aG docker deploy
```

Start a fresh login shell afterward (`su - deploy`) so the Docker group is
picked up.

Also ensure `deploy` can write the dashboard-managed files under each tenant
root:
- `/opt/n8n/<clientN>/dashboard.compose.yml`
- `/opt/n8n/<clientN>/dashboard.env`
- `/opt/n8n/<clientN>/assets/logo.svg`

### 4. Shared deploy registry and update script

Create the shared scripts directory once and install the registry file plus the
update helper GitHub Actions will call:

```bash
# as root
install -d -m 0755 -o deploy -g deploy /opt/scripts
install -m 0644 -o deploy -g deploy /dev/null /opt/scripts/tenants.txt

curl -fsSL https://raw.githubusercontent.com/jperez1804/botargento-dashboard/main/scripts/update-dashboards.sh \
  -o /opt/scripts/update-dashboards.sh

chown deploy:deploy /opt/scripts/update-dashboards.sh
chmod 755 /opt/scripts/update-dashboards.sh
```

### 5. Repo checkout path

The repo checkout does **not** need to live under `/opt/n8n`. The safest
operator-owned location is:

```bash
/home/deploy/_dashboard-checkout
```

That avoids the permission problems you can hit cloning into `/opt/n8n` as
`deploy`. The tenant runtime files still live in `/opt/n8n/<clientN>/`.

### 6. GitHub Release image availability

The VPS pulls:

```bash
ghcr.io/jperez1804/dashboard:latest
```

That tag only exists after the `Release` workflow succeeds on `main`. If a pull
returns `manifest unknown`, fix the failed `Release` run first.

If GHCR visibility or policy requires auth on your VPS, log in once as the
operator account with your GitHub username and a PAT:

```bash
docker login ghcr.io
```

### 7. Compose command compatibility

The helper scripts auto-detect both:
- `docker compose`
- `docker-compose`

So the VPS can use either spelling. For manual ops, prefer the one already used
by that host.

## Provisioning a new tenant

Per blueprint Section 12.3, every new client follows the same runbook.
Target: ≤ 15 minutes of operator time.

### Recommended checkout location

```bash
sudo -iu deploy
mkdir -p /home/deploy
cd /home/deploy

git clone https://github.com/jperez1804/botargento-dashboard.git _dashboard-checkout
# or, on later runs:
# git -C /home/deploy/_dashboard-checkout pull
```

### Per-tenant first install

The interactive helper does most of the work. Run it from the repo checkout,
not from inside `/opt/n8n/<clientN>`:

```bash
# On the VPS, as the deploy user
cd /home/deploy/_dashboard-checkout
bash ./scripts/provision-tenant.sh client3
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
4. Grants database access, hands `dashboard.*` ownership to `dashboard_app`,
   and bootstraps `dashboard.__migrations`
5. Seeds the allowlist
6. Auto-detects the tenant-internal Docker network (handles compose project prefix)
7. Writes `dashboard.compose.yml` + `dashboard.env` into `/opt/n8n/<clientN>/`
8. Pulls the latest image and brings up the container
9. Updates `/opt/scripts/tenants.txt` so future `Deploy` runs include it

Two manual prerequisites the script can't automate:
- **DNS:** in Donweb, add `dashboard.<clientN>` pointing at the same VPS target
  as the existing tenant host. If your current tenant record is an `A` record
  to the VPS IP, create another `A` record. If your current setup uses a
  hostname, use a `CNAME`.
- **Logo:** drop the SVG at `/opt/n8n/<clientN>/assets/logo.svg` before launching

Both are reminded by the script.

### First-time VPS verification

After the script finishes, these are the quickest checks:

```bash
docker logs -f n8n-client3-dashboard
curl -sI https://dashboard.client3.botargento.com.ar
```

If the dashboard is up but the browser shows `DNS_PROBE_FINISHED_NXDOMAIN`,
the app is healthy and public DNS is still missing or propagating.

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
- Sources `dashboard.env` and supports either `docker compose` or `docker-compose`
- Pulls the image, restarts the container, waits up to 30 s for `running`

**Rollback:** trigger the same workflow with `tag=<previous-good-sha>`. ~2 min
round-trip across all tenants.

There is no staging in v1. Validate by deploying to a single canary tenant
first if a change is risky.

If a manual `docker pull ghcr.io/jperez1804/dashboard:latest` returns
`manifest unknown`, the latest `Release` workflow has not published successfully
yet. Fix or rerun `Release` before debugging the VPS further.

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

### Roles

`dashboard.allowed_emails.role` is one of `viewer` (default) or `admin`.
Admins are the only role allowed to change tenant-scoped settings (today
that's just the brand color via `/settings`; future privileged surfaces will
follow the same `requireRole("admin")` pattern in `src/lib/role-guard.ts`).

The provisioner prompts for a first-admin email during a fresh
`scripts/provision-tenant.sh` run. **Existing tenants** need a one-time
promotion:
```bash
docker exec -i n8n-<clientN>-postgres \
  psql -U postgres -d <dbname> \
  -c "UPDATE dashboard.allowed_emails SET role='admin' WHERE email='owner@cliente.com';"
```

Role denials (a viewer attempting `/settings` or POST `/api/settings/theme`)
land in `dashboard.audit_log` with `action='role_denied'` and a metadata
payload of `{required, actual}` so escalation attempts are visible alongside
`login_denied` entries.

### Theming

The brand accent (`--client-primary`) lives in
`dashboard.app_settings.primary_color` — a one-row table per tenant DB. On
container start, migration `0002_app_settings.sql` creates the row and
back-fills it from the `CLIENT_PRIMARY_COLOR` env var, so existing tenants do
not go blank between a theming-enabled deploy and the first manual change.

After the deploy, admins change the color from `/settings` (UI picker + hex
input + curated swatches). The env var becomes the **boot fallback only** —
once the row exists, the DB is the source of truth and there is no need to
edit `/opt/n8n/<clientN>/dashboard.env` to recolor a tenant.

Every change emits a row in `dashboard.audit_log`:
```sql
SELECT created_at, email, metadata
  FROM dashboard.audit_log
 WHERE action = 'theme_update'
 ORDER BY created_at DESC LIMIT 10;
-- metadata: { "from": "#3b82f6", "to": "#8b0000" }
```

Per-intent chart colors stay vertical-locked in
`src/config/verticals/<vertical>.ts` — those map to domain meaning (Ventas,
Alquileres, …) rather than to brand, so they are not picker-controlled.

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
| `git clone ... _dashboard-checkout` under `/opt/n8n` fails with `Permission denied` | `deploy` does not own `/opt/n8n` | Clone the repo under `/home/deploy/_dashboard-checkout` instead |
| `./scripts/provision-tenant.sh: Permission denied` | Missing executable bit on the script | Run `bash ./scripts/provision-tenant.sh clientN` or `chmod +x` once |
| `docker pull ghcr.io/jperez1804/dashboard:latest` returns `manifest unknown` | `Release` did not publish `:latest` yet | Check GitHub Actions → `Release` and fix the failed run first |
| Browser shows `DNS_PROBE_FINISHED_NXDOMAIN` | `dashboard.<clientN>` DNS record does not exist yet | Create the DNS record in Donweb and wait for propagation |
| Container restarts in a loop with `Missing required views` | Tenant Postgres has no `automation` schema | Run `postgres-setup.sql` from `whatsapp-automation-claude` |
| Container loops on migrations after an early failed first install | Tenant was provisioned with an older script/image before the ownership/bootstrap fixes | Pull latest `main` on the VPS and rerun `bash ./scripts/provision-tenant.sh <clientN>` |
| Login form submits but no email arrives | Email not in `dashboard.allowed_emails` | Add it (see Allowlist management) |
| Email arrives but link goes to "AccessDenied" | Email was removed mid-flight, or token expired (>15 min) | Request a new link |
| `network ..._..._-internal declared as external, but could not be found` | Compose project prefix mismatch | `docker network ls \| grep <clientN>` and update `name:` in `dashboard.compose.yml` |
| Charts show zeros despite known activity | View tz drift or wrong `CLIENT_TIMEZONE` | Compare `SELECT day FROM automation.v_daily_metrics` against `CLIENT_TIMEZONE` in env |
| Per-intent handoff rates don't match the global handoff-rate KPI | Expected: per-intent denominators exclude `menu`-only contacts (counted globally) and the average of per-bucket ratios is not the same as the ratio of totals | Disclosure is on screen under the chart; reconciliation isn't possible by design |
| `Resueltas por el bot` looks too high | Self-resolution v1 only excludes business handoffs; contacts still in the follow-up queue count as resolved | Cross-check with `/follow-up`; refinement deferred per `docs/INTENT_KPIS_PLAN.md` |
| Completion-rate row shows `—` for an intent | No `terminalIntents` configured for that bucket in `src/config/verticals/<vertical>.ts` | Add the raw terminal token(s) for the flow; redeploy |
| Heatmap looks empty / sparse | Tenant traffic is thin and the 28-day window still doesn't fill 168 cells | Expected — the metric is more useful once volume grows; nothing to fix |
| 429 on CSV export | 10/minute/session rate limit | Wait a minute; `src/lib/rate-limit.ts` if you need to adjust |
| Refresh button does nothing | Browser cached aggressively | Force-reload (Ctrl+Shift+R); the route response is `Cache-Control: no-store` |
| `/settings` returns 307 / redirects to `/` | Logged-in email is not an admin | Promote it: `UPDATE dashboard.allowed_emails SET role='admin' WHERE email='…';` (see Roles) |
| Color picker change doesn't persist after reload | Migration `0002_app_settings.sql` did not run on this tenant | `docker logs n8n-<clientN>-dashboard 2>&1 \| grep -i 0002` — if missing, redeploy `:latest`; `0002` is additive and idempotent |
| All tenants show `#3b82f6` after the theming deploy | Migration ran but the back-fill from `CLIENT_PRIMARY_COLOR` was skipped because the row already existed | Run once per tenant: `UPDATE dashboard.app_settings SET primary_color = '<env-color>' WHERE id = 1;` |
| Fonts flash to a serif-less fallback for ~200ms | First-paint before Fraunces loads (`display: swap`) | Expected on cold loads; subsequent navigations hit the cache |

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

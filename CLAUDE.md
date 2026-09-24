# botargento-dashboard

Client-facing analytics dashboard for BotArgento WhatsApp-automation tenants. One deployment per client at `dashboard.<clientN>.botargento.com.ar`. Reads the tenant's existing Postgres reporting views.

## Commands

- `pnpm dev` — Start development server (http://localhost:3000)
- `pnpm build` — Production build
- `pnpm start` — Run production build locally
- `pnpm lint` — ESLint + TypeScript type-check
- `pnpm test` — Vitest unit + integration tests
- `pnpm test:e2e` — Playwright E2E tests
- `pnpm db:generate` — Generate Drizzle migration from schema changes
- `pnpm db:migrate` — Apply pending migrations to `TENANT_DB_URL`
- `pnpm db:seed:dev` — Seed local dev DB with fake WhatsApp data

## Tech Stack

Next.js 15 (App Router) + TypeScript strict + Tailwind CSS v4 + shadcn/ui + Recharts + TanStack Table + Drizzle ORM + Postgres + Auth.js v5 (Resend magic link) + Docker + Traefik

## Architecture

### Directory Structure
- `src/app/(auth)/` — Public pages: login, verify
- `src/app/(dashboard)/` — Protected pages: overview, conversations, handoffs, follow-up
- `src/app/api/` — Route handlers: auth callback, CSV exports
- `src/components/dashboard/` — Page-specific visual components (KPI cards, charts, tables)
- `src/components/layout/` — Shell components (sidebar, header, branding)
- `src/components/ui/` — shadcn primitives
- `src/config/verticals/` — Swappable vertical configs; v1 ships `real-estate.ts`
- `src/config/tenant.ts` — Runtime config read from CLIENT_* env vars
- `src/db/` — Drizzle schema + client + typed wrappers for `automation.v_*` views
- `src/lib/queries/` — All SQL lives here; pages call these functions, never inline SQL
- `src/lib/auth.ts` — Auth.js config with Resend magic link + allowlist check
- `src/middleware.ts` — Auth guard for `(dashboard)/*` routes
- `migrations/` — Raw SQL migrations for `dashboard.*` schema (applied on container start)
- `scripts/` — Provisioning, seeding, view-compat verification
- `.github/workflows/` — CI, release (Docker image), deploy (SSH to VPS)

### Data Flow
Server Components await Drizzle queries from `src/lib/queries/*.ts` and render HTML on the VPS. Client Components (`"use client"`) only handle interactivity (charts, tables, forms). No REST API for data — pages query Postgres directly.

### Key Patterns
- **Server Components by default.** Only add `"use client"` when a component needs React state, effects, or event handlers.
- **All SQL goes through `src/lib/queries/*.ts`.** Never inline queries inside page components.
- **All UI labels come from `verticalConfig`.** Zero hardcoded Spanish strings in JSX.
- **All tenant branding comes from `tenantConfig`** (parsed from `CLIENT_*` env vars). White-label from day one.
- **Reads are read-only to `automation.*`.** Writes only touch `dashboard.*`. Enforced at the DB-role level via `dashboard_app`.
- **Migrations run on container start** via `scripts/container-entrypoint.sh`. View-compatibility is verified at boot; the container fails fast if required views are missing.
- **Auth tokens are hashed.** `dashboard.magic_link_tokens` stores SHA-256, never plaintext.
- **Every auth-relevant action goes to `dashboard.audit_log`** — logins, denials, CSV exports.

## Code Organization Rules

1. **One component per file.** Max 300 lines. Extract sub-components when larger.
2. **Path alias:** `@/` → `src/`. Always use it — never relative imports across directories.
3. **No barrel exports.** Import directly from the file that defines the export.
4. **Server Components are the default.** `"use client"` must be justified by actual interactivity needs.
5. **Colocate route-specific components** next to their page. Components used on ≥2 pages go in `src/components/dashboard/` or `src/components/layout/`.
6. **All env vars read via Zod-validated config modules** (`src/config/tenant.ts`, `src/config/env.ts`). Never `process.env.X` directly in feature code.
7. **URL state over component state** for table filters, pagination, date ranges. Keep the URL shareable.

## Design System

### Colors

The dashboard ships the **Reserved Operations** aesthetic: monochrome canvas
with the tenant's `--client-primary` as the only colored element. Always
reference these CSS vars from feature code — do not introduce new hex literals.

| Token | Default | Purpose |
|---|---|---|
| `--client-primary` | `#3b82f6` | Tenant accent; injected from `dashboard.app_settings` at request time. Operators with `role='admin'` change this from `/settings`; the env value is the boot fallback only. |
| `--ink` | `#111827` | Primary text |
| `--muted-ink` | `#6b7280` | Secondary text / kicker captions |
| `--soft-ink` | `#9ca3af` | Tertiary captions, disclaimers |
| `--rule` | `#e5e7eb` | Hairline borders + dividers |
| `--surface` | `#ffffff` | Card backgrounds |
| `--canvas` | `#fafafa` | Page background, hover states |
| `--good` | `#059669` | Positive deltas (semantic, brand-independent) |
| `--bad` | `#dc2626` | Negative deltas (semantic, brand-independent) |

Semantic palettes that stay as hardcoded hex (intentional — they map to
domain meaning, not brand): priority chips (`#F4CCCC`/`#8A1A1A`,
`#FCE5CD`/`#8A4B00`, `#E6F4EA`/`#1B5E20`) and per-intent chart colors
configured in `src/config/verticals/*.ts`.

### Typography
- Body / nav / table: **Geist Sans** (variable `--font-geist-sans`)
- Display headings + hero KPI values: **Fraunces** (variable `--font-fraunces`,
  axes `SOFT` + `opsz`). Used on page mastheads, section headings, and the
  big KPI display values to give the editorial Reserved Operations gravitas.
- Numerics + code + kicker labels: **Geist Mono** (variable `--font-geist-mono`)
  with `tabular-nums` always on.
- Page masthead: 44px / Fraunces 600 / -tracking
- Section heading: 22px / Fraunces 500 + 10px mono kicker line above
- Hero KPI value: 40px / Fraunces 600 / `tabular-nums`
- Standard KPI value: 40px / Fraunces 600 / `tabular-nums`
- Body: 14px / 400
- Table cells: 13px / 400
- Mono kicker: 10px / 500 / 0.18em letter-spacing / uppercase

### Style
- Border radius: 6px default (`rounded-md`), Card uses 6px
- Cards carry a 2px **`--client-primary` top border** (masthead rule) on top of
  the standard 1px `--rule` hairline. The accent strip is the only color on
  the card by default.
- Spacing base: 4px (Tailwind defaults)
- Aesthetic: flat surfaces, hairline borders, no shadows, information-dense.
  Page-load reveal is the *only* motion: `[data-reveal]` with staggered
  `--reveal-delay` per top-level section. Respects `prefers-reduced-motion`.
- Background: `--canvas` plus a ~3% inline-SVG paper-grain texture on `<body>`.
- Locale: es-AR, DD/MM/YYYY, thousand separator `.`, decimal `,`
- Timezone: America/Argentina/Buenos_Aires (overridable per tenant)

## Roles

`dashboard.allowed_emails.role` ∈ `{viewer, asesor, admin}` (ranked in that
order). Any allowlisted email is a viewer by default; admins manage people and
roles from **Configuración › Equipo** (`/settings/team`), or the provisioner
prompts for a first admin during a fresh install.

- **Viewer**: read-only access to all dashboard pages (including `/leads` and
  the CRM card, without controls).
- **Asesor**: viewer + manages leads (stage, owner, activities, reminders) on
  verticals with `features.crmTab`. Can reassign only unassigned leads and
  their own. No Settings, no admin inbox.
- **Admin**: everything — Settings (color, Equipo, audit log), inbox,
  campaign actions, and reassigning any lead.

Pages call `requireRole(min)` from `src/lib/role-guard.ts` (redirects to `/`
and emits a `role_denied` audit row). **Route handlers call
`requireRoleApi(min)` instead**: it answers 401/403 JSON rather than a redirect
that `fetch()` would silently follow and read as a 200.

## CRM-lite (`features.crmTab` + `crm` block on the vertical)

**The business rules live in `docs/crm-oportunidades.md`. Read it before
changing anything here, and update it in the same PR when a rule moves.**

- A lead is an **opportunity**, not a person: one person (`dashboard.contacts`)
  can have several over time, each with its own stage, owner, priority, budget,
  reminder and activity (`dashboard.opportunities`). History is append-only in
  `dashboard.lead_events`, carrying both the person and, usually, the
  opportunity — `migrations/0010_opportunities.sql`.
- **Only a handoff (or a person) opens an opportunity.** Plain messages never
  do; they keep the person's open opportunities alive and, when they carry a
  rubro nobody is working, show a "Consulta nueva" hint. Opening happens at
  read time in `src/lib/queries/opportunity-sync.ts`, with idempotent SQL.
- Automatic stages (nuevo / contactado / calificado / perdido por baja o 30
  días sin actividad) are **derived at read time** by
  `src/lib/crm/effective-stage.ts` and never persisted. That pure function is
  the single source of the stage rules; its unit test is the spec.
- Every `/api/leads/*` body names ONE opportunity (`opportunityId`); the audit
  row carries `opportunity_id` and `contact_wa_id`.
- Raw `sql` writes share the client with drizzle, which replaces postgres.js's
  json/timestamp serializers with identity functions: pass JSON as
  `${JSON.stringify(x)}::jsonb` and dates as ISO strings, never `sql.json()` or
  a `Date` (see `src/lib/queries/lead-writes.ts`).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TENANT_DB_URL` | Postgres connection for this tenant (includes `dashboard_app` user) |
| `VERTICAL` | Vertical config key (e.g. `real-estate`) |
| `CLIENT_NAME` | Shown in header + email subject |
| `CLIENT_LOGO_URL` | Path or URL to the tenant logo |
| `CLIENT_PRIMARY_COLOR` | CSS color for accent + chart primary |
| `CLIENT_TIMEZONE` | IANA tz; default `America/Argentina/Buenos_Aires` |
| `CLIENT_LOCALE` | BCP-47; default `es-AR` |
| `AUTH_SECRET` | 32-byte hex for JWT signing |
| `AUTH_URL` | Full external URL of this deploy |
| `AUTH_EMAIL_FROM` | Sender address (Resend-verified domain) |
| `RESEND_API_KEY` | Resend API key |

## Reglas No Negociables

1. **The dashboard never writes to `automation.*`.** DB role `dashboard_app` has `SELECT`-only on that schema. Any attempt to `INSERT`/`UPDATE`/`DELETE` there is a bug.
2. **No hardcoded Spanish strings in JSX.** All UI text comes from `verticalConfig` or `tenantConfig`.
3. **No `process.env.X` in feature code.** Read through validated config modules.
4. **Every page query is a Server Component.** Never fetch data from a Client Component.
5. **Every auth-sensitive action is logged to `dashboard.audit_log`.** Logins, denials, exports, theme updates, role denials.
6. **Magic link tokens are SHA-256 hashed before storage.** Never plaintext, never logged.
7. **Migrations are additive only.** No `DROP COLUMN` or destructive changes without a multi-deploy migration plan.
8. **Max 300 lines per component file.** Extract when larger.
9. **All env vars validated with Zod at boot.** The container fails fast on misconfiguration, not at request time.
10. **No secrets in Git, ever.** `.env*` is in `.gitignore`. Secrets live in `/opt/n8n/<clientN>/dashboard.env` on the VPS.

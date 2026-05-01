# Theming + Reserved Operations rollout runbook

This rolls **PR1 (Phase A — theming infra) + PR2 (Phase B — settings page +
role guard) + PR3 (Phases C/D/E — Reserved Operations redesign + tests +
docs)** out to live tenants. Read all of [F1](#f1--pre-flight-do-once-before-any-tenant)
once before starting; [F2](#f2--per-tenant-deploy-sequence) is the per-tenant
loop.

> Companion docs:
> - Conventions + design tokens: [`CLAUDE.md`](../CLAUDE.md)
> - Day-to-day operator runbook (allowlist, deploys, troubleshooting): [`README.md`](../README.md)
> - Architectural context (theming control plane, role model): [`docs/BLUEPRINT.md`](BLUEPRINT.md)

---

## F1 — Pre-flight (do once, before any tenant)

1. **Confirm the Release succeeded.** GitHub → Actions → `Release` on `main` →
   most recent run is green. The image tag you'll deploy must exist:
   ```bash
   docker pull ghcr.io/jperez1804/dashboard:latest
   ```
   If you get `manifest unknown`, fix `Release` first.

2. **Confirm `0002_app_settings.sql` is in the image.** From your laptop:
   ```bash
   docker run --rm --entrypoint sh ghcr.io/jperez1804/dashboard:latest -c 'ls migrations/'
   ```
   You should see `0000_init.sql`, `0001_escalation_type.sql`,
   `0002_app_settings.sql`.

3. **Pick a canary tenant.** Pick one tenant (e.g. `client1`) to deploy to
   first. If anything breaks, you only fix one place.

4. **Have first-admin emails ready.** For each existing tenant, decide which
   email gets `role='admin'` (the operator who logs in most). You'll run one
   `UPDATE` per tenant in [F2.4](#f24--promote-the-first-admin).

5. **No Dockerfile changes needed.** Migrations are read at boot by the
   existing entrypoint; Fraunces is fetched at framework layer
   (`next/font/google`); the new pages compile into the same image.

   **If `next build` ever fails in CI complaining about font fetching**, the
   one-line fallback is `ENV NEXT_FONT_GOOGLE_MOCKED_RESPONSES=1` in the
   Dockerfile — try the standard build first.

---

## F2 — Per-tenant deploy sequence

Repeat for `client1`, `client2`, …. Do **canary first**, smoke-test it
([F2.5](#f25--smoke-test)), then loop the rest with `tenant: all`.

### F2.1 — Trigger Deploy workflow

GitHub → Actions → **Deploy** → Run workflow:

- `tenant`: `clientN` for canary; `all` once canary is green.
- `tag`: `latest` (or the specific SHA from the Release run).

The container restart will:

- Run `scripts/container-entrypoint.sh`
- Apply pending migrations including `0002_app_settings.sql`
- The migration is `CREATE TABLE IF NOT EXISTS` + idempotent seed → safe
  per CLAUDE.md rule 7. Auto-back-fills `app_settings.primary_color` from
  the existing `CLIENT_PRIMARY_COLOR` env var so the dashboard does not go
  blank between deploy and first manual change.

### F2.2 — Wait for the container to settle

```bash
docker logs -f n8n-clientN-dashboard 2>&1 | head -80
```

Look for `migration 0002_app_settings.sql applied` (or equivalent — the
entrypoint logs each migration it runs). Bail if you see migration errors.

### F2.3 — Confirm the row + env back-fill

```bash
docker exec -i n8n-clientN-postgres \
  psql -U postgres -d <dbname> \
  -c "SELECT id, primary_color, updated_by FROM dashboard.app_settings;"
```

Expect a single row (`id=1`) with `primary_color` matching that tenant's
existing `CLIENT_PRIMARY_COLOR`. If `primary_color = '#3b82f6'` and you
expected something else, see the
[F2.3 fix](#f23-fix-only-if-back-fill-missed) at the end of this section.

### F2.4 — Promote the first admin

```bash
docker exec -i n8n-clientN-postgres \
  psql -U postgres -d <dbname> \
  -c "UPDATE dashboard.allowed_emails SET role='admin' WHERE email='owner@cliente.com';"
```

The provisioner's first-admin prompt only fires on **fresh** installs —
existing tenants need this once.

### F2.5 — Smoke test

In this order:

1. `curl -sI https://dashboard.clientN.botargento.com.ar` → 200/307.
2. Log in as the promoted admin email.
3. **Sidebar shows `Configuración`.** Click it. Should land on `/settings`,
   not redirect.
4. **Picker pre-filled** with the tenant's current accent.
5. Pick a deliberately different color (e.g. `#8b0000`). Watch the **live
   preview** recolor before save (heatmap, KPI hairlines, sidebar accent).
6. Save → toast `Color actualizado`. Reload `/`. New color persists from DB.
7. Verify the audit row:
   ```sql
   SELECT created_at, email, metadata FROM dashboard.audit_log
    WHERE action = 'theme_update' ORDER BY created_at DESC LIMIT 1;
   -- expect metadata = {"from":"...","to":"#8b0000"}
   ```
8. Log out, log in as a **non-admin** allowlisted email. Sidebar should
   **not** show `Configuración`. Visiting `/settings` directly should
   redirect to `/`. Verify denial:
   ```sql
   SELECT created_at, email, action, metadata FROM dashboard.audit_log
    WHERE action = 'role_denied' ORDER BY created_at DESC LIMIT 1;
   ```

If all eight pass, **canary is good.** Re-run Deploy with `tenant: all` for
the rest.

### F2.3 fix (only if back-fill missed)

If the migration ran but `app_settings.primary_color` came back as the
default `#3b82f6` instead of the tenant's actual color, the row already
existed before the back-fill (rare, but possible if you redeployed
mid-test). Easiest path: log in as admin and pick the right color from
`/settings`. The audit row tells you the operator did it.

If you'd rather restore from the env var directly:

```bash
TENANT_COLOR=$(docker exec n8n-clientN-dashboard sh -c 'echo "$CLIENT_PRIMARY_COLOR"')
docker exec -i n8n-clientN-postgres \
  psql -U postgres -d <dbname> \
  -c "UPDATE dashboard.app_settings SET primary_color = '${TENANT_COLOR}', updated_by = 'runbook-fix' WHERE id = 1;"
```

---

## F3 — Rollback path

| Failure | Action | Round-trip |
|---|---|---|
| Bad image (build, runtime crash, regression) | Re-run Deploy with `tag=<previous-good-sha>` | ~2 min per tenant |
| `0002` migration looks broken on a tenant | The migration is **additive** — image rollback alone is enough; the new table sits unused. No data migration to reverse. | — |
| `app_settings` row is corrupt (impossible but listed for completeness) | `DROP TABLE IF EXISTS dashboard.app_settings;` then redeploy `:latest`. The migration recreates + back-fills from env. | ~1 min |
| You promoted the wrong admin | `UPDATE dashboard.allowed_emails SET role='viewer' WHERE email='…';` — no redeploy needed. | seconds |

**No force-push, no destructive git ops.** Image rollback is the safe path.

---

## F4 — Provisioner change for new tenants

The change to `scripts/provision-tenant.sh` (Phase B) means the **next clean
install** prompts for a first-admin email and seeds it as `role='admin'`
automatically. Existing tenants are unaffected — the prompt only appears
during fresh `bash ./scripts/provision-tenant.sh clientN` runs. Zero action
needed for existing live tenants beyond [F2.4](#f24--promote-the-first-admin).

---

## F5 — Post-deploy verification (optional but cheap)

After all tenants are deployed:

```bash
for c in $(cat /opt/scripts/tenants.txt); do
  echo "=== $c ==="
  docker exec -i n8n-${c}-postgres psql -U postgres -d <dbname> -c \
    "SELECT primary_color, updated_by FROM dashboard.app_settings;"
done
```

Spot-check that every tenant has a row with sensible `primary_color`.
Spot-check the audit log on the canary tenant for the `theme_update` you
wrote in [F2.5](#f25--smoke-test).

To verify every tenant has at least one admin:

```bash
for c in $(cat /opt/scripts/tenants.txt); do
  echo "=== $c ==="
  docker exec -i n8n-${c}-postgres psql -U postgres -d <dbname> -c \
    "SELECT email FROM dashboard.allowed_emails WHERE role = 'admin';"
done
```

Any tenant with an empty result needs an `UPDATE` per
[F2.4](#f24--promote-the-first-admin).

---

## Suggested execution order

1. Pre-flight ([F1](#f1--pre-flight-do-once-before-any-tenant)).
2. Canary `client1` → [F2.1](#f21--trigger-deploy-workflow) – [F2.5](#f25--smoke-test).
3. Loop rest with `tenant: all` → [F2.5](#f25--smoke-test) abbreviated per
   tenant (just step 5–6).
4. Spot-check ([F5](#f5--post-deploy-verification-optional-but-cheap)).

Total operator time per tenant after canary: ~3 minutes (deploy click +
smoke test + admin promote).

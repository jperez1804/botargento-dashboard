# Intent KPIs Plan

## Goal
Show two separate intent views on the overview dashboard:

- **Contactos por intención**: demand view. Counts each contact once per business intent in the selected window.
- **Volumen por intención**: bot activity view. Counts message/interactions per business intent, including every step inside a flow.

These answer different questions and should not be merged into one KPI.

## What Was Changed Already
The old "Mensajes por intención" chart used `automation.v_flow_breakdown.inbound_count`.
That counted every inbound user reply in a flow. For example, one contact moving
through a 7-step sales flow could add several counts to `sales_lead`, even though
it was only one real sales lead.

The implemented change converts that chart into **Contactos por intención**:

- `src/lib/queries/intents.ts` now reads `automation.lead_log` directly.
- It selects distinct `(contact_wa_id, intent)` rows for inbound messages in the last 7 days.
- It translates raw automation tokens with `formatBusinessIntentLabel`.
- It groups by the translated business label.
- It dedupes with a `Set` so one contact counts once per intent bucket.
- It excludes `menu` because menu traffic is navigation, not a business intent.
- Unknown values still fall into `Otras`.

Example result:

```text
One contact with 7 sales-flow replies:
sales_lead / guided_sales_zone
sales_lead / guided_sales_property_type
sales_lead / guided_sales_bedrooms
...

Contactos por intención:
Consulta por compra = 1
```

## Why We Still Need Volume
The unique-contact chart is good for business demand, but it hides operational load.
If one contact goes through many flow steps, the bot did more work than a single
click. We still want to know that volume.

That second view should intentionally count repeated flow steps.

Example result:

```text
One contact with 7 sales-flow replies:

Contactos por intención:
Consulta por compra = 1

Volumen por intención:
Consulta por compra = 7 user interactions
```

## Proposed Volume KPI
Add a second chart/card called **Volumen por intención**.

Recommended first version:

- Count **inbound user interactions** per business intent.
- Use `automation.v_flow_breakdown.inbound_count` because it already represents inbound step volume.
- Exclude `menu`.
- Use the same Spanish business buckets as `Contactos por intención`.
- Keep unknown values grouped under `Otras`.

This answers: **"How much flow traffic did the bot handle for each business intent?"**

## Optional Later Variant
If we want total chat traffic instead of only user interactions, add a toggle or
separate metric:

- **Interacciones de usuarios**: inbound only.
- **Mensajes del bot**: outbound only.
- **Mensajes totales**: inbound + outbound.

That requires querying `automation.lead_log` by `direction` instead of only using
`automation.v_flow_breakdown`.

## Implementation Plan
1. Keep the current `getIntentCounts(7)` behavior for **Contactos por intención**.
2. Add `getIntentMessageCounts(7)` in `src/lib/queries/intents.ts`.
3. In `getIntentMessageCounts`, read `automation.v_flow_breakdown`, sum `inbound_count`, and bucket with `formatBusinessIntentLabel`.
4. Refactor `IntentsChart` to accept title/subtitle/count label props, for example:

```ts
title="Contactos por intención"
summaryLabel="contactos únicos por intención"
tooltipLabel="Contactos"
```

and:

```ts
title="Volumen por intención"
summaryLabel="interacciones en flujos"
tooltipLabel="Interacciones"
```

5. Render both charts on the overview page:

- Left/top: `Contactos por intención`.
- Right/bottom: `Volumen por intención`.

6. Update tests to expect both chart titles.

## Acceptance Criteria
- `Contactos por intención` counts one contact once per business intent.
- `Volumen por intención` counts repeated flow-step interactions.
- `menu` is not shown as its own intent and does not inflate `Otras`.
- Raw tokens such as `sales_lead`, `rental_lead`, and `guided_*` do not appear in the UI.
- No database values, migrations, reporting views, or CSV exports are changed.

---

# Phase 2 — Items 1–8 + Missing KPIs

## Context

The two-chart baseline above gives a snapshot of demand and bot load, but the dashboard still doesn't surface conversion gaps, momentum, or the bot's ROI. Phase 2 layers 8 user-picked KPIs and 3 analyst-recommended additions on top.

A critical review by `business-analytics:business-analyst` flagged latent design flaws in three of the original eight items (mis-named formula, hidden double-counting, business-hours contamination). Those are corrected here before any code is written.

## Analyst-driven corrections to the original 8

| # | Original | Correction |
|---|---|---|
| 1 | "Drop-off ratio" (`contacts ÷ messages`) | Rename to **"Interacciones por contacto"**. Same math, honest label. The real funnel-completion metric becomes a separate Phase 5 item. |
| 2 | Per-intent handoff rate, single global color threshold | Add `desiredHandoffRate` per intent in `realEstate.intents`. Color relative to per-intent target. UI must disclose attribution rule ("último contacto") so operators don't try to reconcile per-intent rates with the global handoff KPI. |
| 4 | Delta arrow vs prior 7d | Handle prior=0 → render `Nuevo` or `—`, never `+Inf%`. |
| 6 | Median time-to-handoff | UI disclaimer: timer runs on wall-clock, not business hours. Render `—` when `n < 5`. Business-hours-aware variant deferred. |
| 8 | 7d hour × weekday heatmap | **Default to 28d window**, independent of the global 7d filter. With 7d, 168 cells over ~200 contacts is too sparse. |

## Scope and phasing (reordered by business value)

The original phases (0 → 1 → 2 → 3 → 4) were grouped by topic. The reorder below ships highest-leverage / lowest-risk first.

### Phase 0 — Finish the original plan (prerequisite)

| Item | File |
|---|---|
| Add `getIntentMessageCounts(days)` reading `automation.v_flow_breakdown.inbound_count`, bucketed by `formatBusinessIntentLabel`, excluding `menu` | `src/lib/queries/intents.ts` |
| Parameterize `IntentsChart` (`title`, `summarySuffix`, `tooltipLabel`) | `src/components/dashboard/IntentsChart.tsx` |
| Render both charts on overview (`Contactos` + `Volumen`) | `src/app/(dashboard)/page.tsx` |
| E2E asserts `Volumen por intención` heading | `tests/e2e/dashboard.spec.ts` |

### Phase 1 — Cheapest, highest-visibility wins

#### 1.1 Leading-intent KPI card (originally item 3)
- Pure composition. Refactor `getIntentCounts` to accept `(days, offsetDays)`, mirroring `getWindowKpis(startDaysAgo, endDaysAgo)` (`src/lib/queries/metrics.ts:59`).
- Pick the top bucket in current window. Compute delta vs prior using `computeDelta` (`src/components/dashboard/KpiCard.tsx:23-29`).
- Render as a 5th `KpiCard`. Layout shifts the KPI grid from `xl:grid-cols-4` to `xl:grid-cols-5`.
- Tiebreak: alphabetical fallback when two intents tie.

#### 1.2 `Otras` drill-down (originally item 7)
- New query `getOtrasBreakdown(days)`. Returns top N (=10) raw `lead_log.intent` tokens whose `formatBusinessIntentLabel` resolves to `"Otras"`.
- UI: collapsed `<details>` under the `Contactos por intención` chart. Body: `raw_token · 12 contactos`.
- Ships early because it improves the **accuracy of every other intent metric** by closing the labeling feedback loop.

### Phase 2 — Per-intent handoff rate (was item 2)

Now that `Otras` is no longer a black box, per-intent metrics are trustworthy.

- Add `desiredHandoffRate?: number` to `IntentDef` in `src/config/verticals/_types.ts`.
- Initial values in `src/config/verticals/real-estate.ts` (tune after first review):
  - Ventas: 0.80, Alquileres: 0.80, Tasaciones: 0.95, Administracion: 0.90, Emprendimientos: 0.20, Otras: 0.70.
- New query `getIntentHandoffRates(days)` returning `{ intent, contacts, contactsHandedOff, rate }[]`.
- SQL: `lead_log` ↔ `escalations` joined on `contact_wa_id`, `escalation_type = 'business'`, `escalation_timestamp` in window. Intent attribution = contact's last inbound intent in window via `DISTINCT ON (contact_wa_id) ... ORDER BY log_timestamp DESC`.
- UI: chip next to each bar in `Contactos por intención`. Color = green if `actual ≥ desired - 0.10`, red if `actual < desired - 0.10`, gray if undefined.
- **Required UI disclaimer:** *"Atribución por último contacto: cada contacto aparece en una sola fila. La suma de tasas no equivale a la tasa global de derivación: contactos cuya última actividad fue navegación del menú quedan fuera de estas filas pero cuentan en la tasa global, y el promedio de proporciones por bucket no coincide con el cociente total."*
- Per-intent rates do NOT sum to the global handoff KPI — intentional and disclosed. Two distinct reasons: (1) `menu`-only contacts are excluded from per-intent denominators by `formatBusinessIntentLabel` but counted by the global `v_daily_metrics.handoff_rate` denominator; (2) `Σ (handoffs / contacts)` ≠ `Σ handoffs / Σ contacts` regardless of attribution.

### Phase 3 — Per-bucket delta arrows (was item 4)

- Extend Phase 0/1/2 queries to return `{ intent, count, previousCount }[]`. Same SQL run twice with `(6, 0)` and `(13, 7)`.
- `IntentsChart` renders an arrow + percent next to each bar. Reuse `formatSignedPercent` and the `KpiCard` icon set.
- Division-by-zero rule: `previousCount === 0 && count > 0` → render `Nuevo`. Both zero → nothing.

### Phase 4 — Hour × weekday heatmap (was item 8)

- New query `getIntentHeatmap(days, intent?)`. **Default `days = 28`**. Returns `{ dow: 0..6, hour: 0..23, count: number }[]`.
- SQL: `EXTRACT(DOW...)`, `EXTRACT(HOUR...)`, `GROUP BY 1,2`. Optional `intent` filter via `formatBusinessIntentLabel(intent) = $bucket`.
- UI: new `IntentHeatmap.tsx`. CSS Grid 7×24. Background = `--client-primary` with opacity = `count / max`. Native `title=` tooltip.
- Intent picker scoped to `vertical.intents` keys + a "Todas" option (no raw-token leakage).
- Title: `Demanda por hora — últimos 28 días` (independent from the page's 7-day filter).

### Phase 5 — Missing KPIs from analyst review

#### 5.1 Tasa de finalización de flujo (real funnel completion)
- Add `terminalIntents?: string[]` per `IntentDef` in vertical config.
- New query `getIntentCompletionRates(days)` returning `{ intent, started, completed, rate }[]`.
- SQL: per contact in window, did any of their inbound intents fall into `terminalIntents` for that intent's bucket? `started` = unique contacts in bucket; `completed` = unique contacts with a terminal token.
- This is what users will read as "drop-off" intuitively. Replaces the original misleading item 1.

#### 5.2 Tasa de re-enganche (re-engagement)
- New query `getReEngagementRate(days, withinHours = 48)`. Returns `{ followUpsSent, replied, rate }`.
- SQL: outbound rows in `lead_log` flagged as follow-up. Inbound from same `contact_wa_id` within `withinHours` = "replied".
- KPI card next to handoff-rate. Decision driven: "is our follow-up cadence working?".
- **Caveat:** depends on follow-up sends being identifiable in `lead_log`. May require an upstream n8n schema change; if so, this item slides.

#### 5.3 Tasa de auto-resolución del bot
- New query `getBotSelfResolutionRate(days)`. Returns `{ contactsTotal, contactsSelfResolved, rate }`.
- SQL: contacts who entered any intent flow, never produced an `escalations` row, and are not in `v_follow_up_queue`.
- 6th KPI card. **The ROI metric** the brokerage owner shows justifying the subscription. Frame as success: "X% de consultas resueltas sin intervención humana".

### Phase 6 — Interacciones por contacto (was item 1, fixed)

- Renamed from "Drop-off ratio". Same SQL: `COUNT(*) ÷ COUNT(DISTINCT contact_wa_id)`.
- UI: render under each bar in `Volumen por intención`. Format: `4 interacciones por contacto`.
- Engagement-density read; not the "did people finish?" metric (that's 5.1).

### Phase 7 — Time-to-handoff (was item 6)

- New query `getIntentTimeToHandoff(days)` returning `{ intent, medianSeconds, p90Seconds, sampleSize }[]`.
- SQL: `escalation_timestamp - first_inbound_timestamp` per handed-off contact. `percentile_cont(0.5)`/`(0.9)` `WITHIN GROUP (ORDER BY duration)` grouped by intent bucket. Render `—` when `sampleSize < 5`.
- UI: small table under the handoff-rate chips. Disclaimer: *"Tiempos en reloj real, incluyen horario no laboral."*
- New helper `formatDuration(seconds, locale)` in `src/lib/format.ts`.

### Phase 8 — First/last-touch toggle (was item 5)

- Refactor `getIntentCounts({ days, offsetDays, touch: "first"|"last"|"any" })`. Default `last`.
- SQL: `DISTINCT ON (contact_wa_id) ... ORDER BY log_timestamp ASC|DESC` over inbound rows.
- UI: pill toggle above `Contactos por intención`. URL state via `?touch=` following `ContactsFilters` pattern.
- UI label always pinned: "mostrando: último contacto" / "primer contacto".

## Resolved decisions

| # | Decision |
|---|---|
| 1 | KPI 1 renamed to "Interacciones por contacto" (Phase 6); real funnel completion lives in Phase 5.1 with `terminalIntents` config |
| 2 | Adding the 3 missing KPIs as Phase 5 |
| 3 | Phase order: 0 → 1.1 + 1.2 → 2 → 3 → 4 → 5 → 6 → 7 → 8 |
| 4 | `desiredHandoffRate` added per intent. Initial: Ventas 0.80, Alquileres 0.80, Tasaciones 0.95, Administracion 0.90, Emprendimientos 0.20, Otras 0.70 |
| 5 | Heatmap window default = 28 days |

## Remaining open questions

- **Phase 5.2:** does `lead_log` already mark follow-up sends? If not, blocked on an upstream n8n change.
- **Phase 5.1:** canonical terminal token per intent? Inspect `lead_log.intent` distribution in production to confirm.
- **Phase 7:** ship with wall-clock disclaimer or wait for business-hours math? Default: ship with disclaimer.

## PR split

| PR | Phases |
|---|---|
| 1 | Phase 0 + 1.1 + 1.2 |
| 2 | Phase 2 |
| 3 | Phase 3 |
| 4 | Phase 4 |
| 5 | Phase 5.1 + 5.3 (5.2 separately if unblocked) |
| 6 | Phase 6 |
| 7 | Phase 7 |
| 8 | Phase 8 |

## Acceptance for the whole epic

- Each new KPI sourced from existing tables/views.
- Every raw token in UI passes through `formatAutomationLabel` or `formatBusinessIntentLabel`.
- All toggles persist via URL query params.
- E2E covers at least one assertion per visible feature.
- Per-intent rates that don't sum to global rates have on-screen attribution disclosure.
- Metrics with small-sample edge cases render `—`, never crash or `+Inf%`.

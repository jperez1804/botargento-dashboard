# Attribution UX Todo

## Status
Priorities 1–5 below are now ✅ implemented (selector renamed to "Cómo contar
contactos"; advanced modes hidden behind a disclosure; "Intención líder" carries
a "Según: …" caption; handoff disclaimer collapsed; engagement-density note
added; "Todas las consultas" warning surfaced both inline and in the chart
summary). The Spanish copy lives on `verticalConfig.attribution` per
CLAUDE.md rule #2 — no more hardcoded selector strings. Priority 6 (client
validation) remains as a follow-up activity.

The current metric behavior is documented in `README.md` and the implementation
rationale lives in `docs/INTENT_KPIS_PLAN.md`.

## What Improved
The current dashboard is much clearer than the first attribution version:

- The page is organized as a story: `Operaciones del período`, `Volumen diario`, `Intenciones`, `Operativo`, and `Seguimiento`.
- The attribution control now sits inside the `Composición de la demanda` section instead of looking like a global page filter.
- `Contactos por intención` changes its summary by selected mode.
- `Cualquier intención` now warns that one contact can count in multiple categories.
- `Volumen por intención` is separated from `Contactos por intención`, which correctly distinguishes bot workload from unique-contact demand.
- `Top valores en Otras` is collapsed by default, reducing client noise while preserving operator visibility.
- `Demanda por hora` has its own `heatmapIntent` filter and persisted URL state.
- The URL keeps the state shareable with `?touch=last|first|any` and `?heatmapIntent=...`.

## Current Shipped Behavior
The selector currently appears as:

```text
Atribución:
Último contacto | Primer contacto | Cualquier intención
```

It maps to `?touch=`:

| Mode | Current meaning |
|---|---|
| `last` | Each contact is counted in the bucket of their last inbound business intent in the window. |
| `first` | Each contact is counted in the bucket of their first inbound business intent in the window. |
| `any` | A contact can be counted in every distinct business intent they touched in the window. |

Example contact journey:

```text
1. Ventas
2. Tasaciones
3. Alquileres
```

| Option | What happens |
|---|---|
| `Último contacto` | The contact counts only in `Alquileres`. |
| `Primer contacto` | The contact counts only in `Ventas`. |
| `Cualquier intención` | The contact counts in `Ventas`, `Tasaciones`, and `Alquileres`. |

## What The Selector Actually Affects

| Surface | Affected by selector? | Notes |
|---|---:|---|
| `Contactos por intención` bars | Yes | Main intended scope. |
| `Intención líder` KPI | Yes | Uses `intentCounts[0]`, so it changes with `?touch=` even though the card appears above the selector. |
| Contact chart deltas | Yes | Current and previous windows use the selected mode. |
| `Interacciones por contacto` chips | Partially | Volume bars do not change, but the denominator comes from the selected contact buckets. |
| `Volumen por intención` bars | No | Counts flow-step volume, not unique-contact attribution. |
| Handoff-rate chips in `Contactos por intención` | No | They use last-touch attribution regardless of selected mode. |
| `Top valores en Otras` | No | Operator drill-down for raw tokens that map to `Otras`. |
| `Mensajes entrantes` / `Mensajes salientes` | No | Global message totals. |
| `Contactos únicos` | No | Global unique contacts. |
| Global `Tasa de derivación` | No | Global handoff rate. |
| `Resueltas por el bot` | No | Separate global self-resolution metric. |
| `Demanda por hora` | No | Uses its own `heatmapIntent` filter. |
| `Finalización de flujos` | No | Uses last-touch logic in its query. |
| `Tiempo hasta derivación` | No | Uses last-touch logic in its query. |

## Remaining UX Problems

- `Atribución` is still an analyst word, not a client-friendly product label.
- `Último contacto`, `Primer contacto`, and `Cualquier intención` are accurate, but they do not explain the business question being answered.
- The selector is better scoped visually, but users may still assume it changes both charts equally.
- `Intención líder` is affected by the selector but appears above it, so the dependency is hidden.
- `Interacciones por contacto` can change because its denominator changes, while the `Volumen por intención` bars remain fixed.
- Handoff-rate chips are rendered inside the selectable contact chart but remain fixed to last-touch attribution.
- The handoff disclaimer is accurate, but it is long and small; clients may skip it.
- `Cualquier intención` can make totals exceed `Contactos únicos`; this is now disclosed in the chart summary, but it should be obvious before selecting the option.

## Recommended Product Direction

Keep the default dashboard simple and decision-oriented:

- Default mode remains last-touch.
- Present the default as a business concept, not an attribution model.
- Treat first-touch and any-touch as advanced analysis, useful for operators but not always necessary for clients.
- Make the scope of the selector explicit next to the control, not only in chart footnotes.

Recommended visible label:

```text
Cómo contar contactos
```

Recommended option labels:

| Current | Recommended | Helper text |
|---|---|---|
| `Último contacto` | `Último interés` | Cuenta al contacto donde terminó su conversación. |
| `Primer contacto` | `Interés inicial` | Cuenta al contacto por lo primero que consultó. |
| `Cualquier intención` | `Todas las consultas` | Puede contar una misma persona en más de una categoría. |

## Todo List

### Priority 1 - Clarify Labels And Scope

- Rename the selector label from `Atribución` to `Cómo contar contactos`.
- Rename options to `Último interés`, `Interés inicial`, and `Todas las consultas`.
- Add a scope note beside or below the selector:

```text
Cambia Contactos por intención, Intención líder y métricas por contacto. No cambia el volumen de mensajes ni los KPIs globales.
```

- Add an immediate warning for `Todas las consultas`:

```text
Una misma persona puede aparecer en más de una categoría.
```

### Priority 2 - Fix Hidden Coupling In `Intención líder`

- Add a small caption to the KPI card:

```text
Según: Último interés
```

- Or move `Intención líder` into the `Composición de la demanda` section so it is visually controlled by the same selector.
- If the KPI should always be stable, pin it to last-touch and stop changing it with `?touch=`.

### Priority 3 - Fix Metric Scope Ambiguity

- Rename the handoff chip area to make the fixed attribution clear:

```text
Derivación por último interés
```

- If handoff chips stay inside the contact chart, add a short sublabel:

```text
Siempre calculado por último interés.
```

- Add a short explanation near `Interacciones por contacto`:

```text
El volumen no cambia con esta vista; el promedio usa los contactos de la vista seleccionada.
```

- Keep `Finalización de flujos` and `Tiempo hasta derivación` labeled as last-touch if they remain fixed.

### Priority 4 - Reduce Client Cognitive Load

- Hide `Interés inicial` and `Todas las consultas` behind an `Análisis avanzado` disclosure.
- Keep the default dashboard state as `Último interés`.
- Consider making advanced attribution modes operator-only or tenant-configurable.

### Priority 5 - Improve Education In The UI

- Add an info tooltip next to `Cómo contar contactos`.
- Suggested tooltip copy:

```text
Si una persona consulta por varias cosas, elegimos cómo asignarla a una categoría. Por defecto usamos su último interés porque muestra dónde terminó la conversación.
```

- Replace the long handoff disclaimer with a shorter visible line plus a collapsible detail, for example:

```text
Derivación calculada por último interés. Ver detalle de cálculo.
```

### Priority 6 - Validate With A Client

- Show the three labels to one real client or non-technical user.
- Ask them what they think each option means before explaining it.
- If they cannot predict the behavior, keep only `Último interés` in the client UI and move the rest to an operator-only view.

## Acceptance Criteria

- A non-technical client can understand the selector without backend terminology.
- The UI clearly says which metrics the selector affects.
- `Intención líder` no longer changes from a control located far below it without an explicit caption.
- No chart visually mixes selectable attribution with fixed last-touch metrics without a label.
- `Todas las consultas` clearly warns that totals may exceed global unique contacts.
- Default view remains simple and decision-oriented.

## Out Of Scope

- No database value changes.
- No reporting-view changes.
- No CSV export behavior changes.
- No change to the underlying `last`, `first`, or `any` query semantics unless a separate product decision approves it.

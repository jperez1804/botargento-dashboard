# Attribution UX Todo

## Context
The overview currently exposes an attribution selector:

- `Ultimo contacto`
- `Primer contacto`
- `Cualquier intencion`

Technically this is useful, but for a client-facing dashboard it can be confusing.
The word "Atribucion" is analytical, and the options do not clearly explain what
part of the dashboard they affect.

The goal of this todo is to make the feature understandable for a non-technical
real-estate client without losing analytical depth for operators.

## Current Behavior
The selector changes how contacts are assigned to buckets in `Contactos por intencion`.

Example contact journey:

```text
1. Ventas
2. Tasaciones
3. Alquileres
```

| Option | What happens |
|---|---|
| `Ultimo contacto` | The contact counts only in `Alquileres`. |
| `Primer contacto` | The contact counts only in `Ventas`. |
| `Cualquier intencion` | The contact counts in `Ventas`, `Tasaciones`, and `Alquileres`. |

## UX Problems

- The label `Atribucion` is not client-friendly.
- The option names do not explain the business question being answered.
- The selector scope is unclear: users may assume it changes every KPI on the page.
- `Cualquier intencion` can make totals exceed `Contactos unicos`, which is correct but surprising.
- Handoff-rate chips are visually attached to `Contactos por intencion`, but their query currently uses last-touch attribution regardless of the selected mode.
- The page already has many metrics, so this control adds cognitive load at the top of a complex section.

## What The Selector Actually Affects

| Surface | Affected by selector? | Notes |
|---|---:|---|
| `Contactos por intencion` bars | Yes | Main intended scope. |
| `Intencion lider` KPI | Yes | It uses the same contact bucket result. |
| Contact chart deltas | Yes | Current and previous windows use the selected mode. |
| `Interacciones por contacto` chips | Yes | The denominator comes from the selected contact buckets. |
| Handoff-rate chips | No, currently | They use last-touch attribution. This is a UX risk because they are shown inside the same chart card. |
| `Volumen por intencion` bars | No | Counts flow-step volume, not unique-contact attribution. |
| `Mensajes entrantes` / `Mensajes salientes` | No | Global message totals. |
| `Contactos unicos` | No | Global unique contacts. |
| Global `Tasa de derivacion` | No | Global handoff rate. |
| `Resueltas por el bot` | No | Separate global self-resolution metric. |
| `Demanda por hora` | No | Uses its own intent filter. |
| `Finalizacion de flujos` | No, currently | Uses its own last-touch logic. |
| `Tiempo hasta derivacion` | No, currently | Uses its own last-touch logic. |

## Recommended Product Direction

For the client-facing dashboard, default to a simple view:

- Use one default mode: **Ultimo interes**.
- Hide advanced attribution modes behind a small "Analisis avanzado" control.
- Make the selector scope explicit when advanced mode is open.

Recommended visible label:

```text
Como contar contactos
```

Recommended option labels:

| Current | Recommended | Helper text |
|---|---|---|
| `Ultimo contacto` | `Ultimo interes` | Cuenta al contacto donde termino su conversacion. |
| `Primer contacto` | `Interes inicial` | Cuenta al contacto por lo primero que consulto. |
| `Cualquier intencion` | `Todas las consultas` | Puede contar una misma persona en mas de una categoria. |

## Todo List

### Priority 1 - Clarify The Current UI

- Rename the selector label from `Atribucion` to `Como contar contactos`.
- Rename options to `Ultimo interes`, `Interes inicial`, and `Todas las consultas`.
- Add a one-line scope note below the selector:

```text
Esta opcion solo cambia Contactos por intencion, Intencion lider y los calculos derivados de contactos.
```

- Add a specific warning for `Todas las consultas`:

```text
En esta vista, una misma persona puede aparecer en mas de una categoria.
```

### Priority 2 - Fix Metric Scope Ambiguity

- Move handoff-rate chips out of the contact chart card, or label them as:

```text
Derivacion por ultimo interes
```

- If handoff chips stay inside the chart, show a small sublabel:

```text
Siempre calculado por ultimo interes.
```

- Decide whether `Finalizacion de flujos` and `Tiempo hasta derivacion` should also follow the selector or remain fixed to last-touch attribution.
- If they remain fixed, their cards should say `por ultimo interes`.

### Priority 3 - Reduce Client Cognitive Load

- Hide `Interes inicial` and `Todas las consultas` behind an `Analisis avanzado` disclosure.
- Keep default dashboard state as `Ultimo interes`.
- Consider removing the selector entirely from client tenants unless an operator enables it.

### Priority 4 - Improve Education In The UI

- Add an info tooltip next to `Como contar contactos`.
- Suggested tooltip copy:

```text
Si una persona consulta por varias cosas, elegimos como asignarla a una categoria. Por defecto usamos su ultimo interes porque muestra donde termino la conversacion.
```

- Add chart summary copy that changes by selected mode:

| Mode | Summary copy |
|---|---|
| `Ultimo interes` | `Contactos segun donde termino la conversacion.` |
| `Interes inicial` | `Contactos segun lo primero que consultaron.` |
| `Todas las consultas` | `Todas las senales de interes. Una persona puede aparecer en varias categorias.` |

### Priority 5 - Validate With A Client

- Show the three labels to one real client or non-technical user.
- Ask them what they think each option means before explaining it.
- If they cannot predict the behavior, keep only `Ultimo interes` in the client UI and move the rest to an operator-only view.

## Acceptance Criteria

- A non-technical client can understand the selector without reading backend terminology.
- The UI clearly says which metrics the selector affects.
- No chart visually mixes selectable attribution with fixed last-touch metrics without a label.
- `Todas las consultas` clearly warns that totals may exceed global unique contacts.
- Default view remains simple and decision-oriented.


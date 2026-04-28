# Client-Friendly Labels Implementation

## Goal
Replace raw automation tokens shown in the dashboard UI with Spanish,
client-friendly labels, without changing database values, reporting views, or
CSV exports.

## Label Mapping

| Raw value | UI label |
|---|---|
| `sales_lead` | Consulta por compra |
| `rental_lead` | Consulta por alquiler |
| `owners_advisor` | Consulta de propietario |
| `Owners` / `owners` | Propietarios |
| `Valuations` / `valuations` | Tasaciones |
| `Unspecified` / `unspecified` | Sin especificar |
| `Rents` / `rents` | Alquileres |
| `Sales` / `sales` | Ventas |

## Affected UI

- Follow-up queue: row reason labels on the overview and `/follow-up`.
- Handoffs: summary card titles and table target labels on `/handoffs`.
- Conversation surfaces: fallback intent labels in contact tables and timelines if raw tokens appear.
- Intents chart: keep configured intent labels, and avoid exposing known raw tokens as-is.

## Implementation Approach

- Add a central display helper, `src/lib/automation-labels.ts`.
- Normalize values case-insensitively and support `_`, `-`, and spacing variants.
- Use the helper only at render/display boundaries.
- Do not mutate query results, database records, migrations, reporting views, or CSV export values.
- Remove uppercase styling from dynamic handoff labels so labels display as normal Spanish text.

## Validation

- Unit-test the helper mappings, casing, separators, null/empty handling, and unknown fallback.
- Verify the dashboard, seguimiento, derivaciones, conversations table, and timeline no longer show the listed raw values.
- Run `pnpm lint` and `pnpm exec tsc --noEmit`.
- Run `pnpm test` if the local environment allows it; prior Windows runs hit Vitest/Vite `spawn EPERM`.

## Acceptance Criteria

- No listed raw token appears in client-facing UI.
- Unknown values still render safely using their original value.
- CSV exports remain unchanged and machine-readable.
- No database, migration, or reporting-view change is required.

const AUTOMATION_LABELS: Record<string, string> = {
  sales_lead: "Consulta por compra",
  rental_lead: "Consulta por alquiler",
  owners_advisor: "Consulta de propietario",
  guided_sales_post_results_advisor: "Consulta por compra",
  guided_sales_post_results_visit: "Consulta por compra",
  guided_rents_post_results_advisor: "Consulta por alquiler",
  guided_rents_post_results_visit: "Consulta por alquiler",
  post_results_advisor: "Consulta por compra",
  post_results_visit: "Consulta por compra",
  post_results_handoff: "Consulta por compra",
  otras_handoff: "Otras consultas",
  tasaciones_handoff: "Pedido de tasación",
  emprendimientos_handoff: "Consulta por emprendimientos",
  emprendimientos_advisor: "Consulta por emprendimientos",
  owners_handoff: "Consulta de propietario",
  admin_propietarios: "Administración / Propietarios",
  questions: "Consultas generales",
  owners: "Propietarios",
  owners_lead: "Propietarios",
  valuations: "Tasaciones",
  unspecified: "Sin especificar",
  rents: "Alquileres",
  sales: "Ventas",
  emprendimientos_lead: "Emprendimientos",
};

const INTENT_BUCKET_LABELS: Record<string, string> = {
  ventas: "Ventas",
  alquileres: "Alquileres",
  tasaciones: "Tasaciones",
  emprendimientos: "Emprendimientos",
  administracion: "Administracion",
  otras: "Otras",
};

// Maps raw automation tokens to the BUSINESS BUCKET they belong to for chart
// aggregation. Bucket name must match an `IntentDef.key` in the vertical config
// so the bar chart and heatmap picker reconcile.
//
// IMPORTANT: this is intentionally separate from `AUTOMATION_LABELS`, which
// drives tables / follow-up reasons / handoff cells (operators want the more
// specific term there, e.g. "Consulta de propietario"). Both can exist for the
// same token because the operator-facing strings differ from the bucket name.
const INTENT_BUCKET_OVERRIDES: Record<string, string> = {
  // Ventas family
  sales_lead: "Ventas",
  sales: "Ventas",
  guided_sales_post_results_advisor: "Ventas",
  guided_sales_post_results_visit: "Ventas",
  post_results_advisor: "Ventas",
  post_results_visit: "Ventas",
  // Alquileres family
  rental_lead: "Alquileres",
  rents: "Alquileres",
  guided_rents_post_results_advisor: "Alquileres",
  guided_rents_post_results_visit: "Alquileres",
  // Tasaciones
  valuations: "Tasaciones",
  // Administracion (combines the "Administración / Propietarios" menu option)
  owners: "Administracion",
  owners_lead: "Administracion",
  owners_advisor: "Administracion",
  // Emprendimientos
  emprendimientos_lead: "Emprendimientos",
  // Otras
  otras_handoff: "Otras",
};

const EXCLUDED_INTENT_BUCKETS = new Set(["menu"]);

export function normalizeAutomationToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function formatAutomationLabel(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return AUTOMATION_LABELS[normalizeAutomationToken(trimmed)] ?? trimmed;
}

/**
 * Business KPI bucket for intent charts. Unknown raw automation values are grouped
 * under "Otras". Lookup order:
 *   1. INTENT_BUCKET_OVERRIDES — folds operator-friendly token families into
 *      their canonical chart bucket (e.g. owners* → "Administracion").
 *   2. INTENT_BUCKET_LABELS — direct bucket-name lookup (e.g. "ventas" → "Ventas").
 *   3. "Otras" — anything we don't recognize.
 *
 * AUTOMATION_LABELS is intentionally NOT consulted here — that map drives
 * operator-facing display strings (table rows, follow-up reasons), which
 * deliberately differ from the bucket label.
 */
export function formatBusinessIntentLabel(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = normalizeAutomationToken(trimmed);
  if (EXCLUDED_INTENT_BUCKETS.has(normalized)) return null;

  return (
    INTENT_BUCKET_OVERRIDES[normalized] ?? INTENT_BUCKET_LABELS[normalized] ?? "Otras"
  );
}

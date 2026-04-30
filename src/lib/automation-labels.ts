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
  otras_handoff: "Otras consultas",
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
 * under "Otras", while display-only labels keep their client-friendly Spanish names.
 */
export function formatBusinessIntentLabel(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = normalizeAutomationToken(trimmed);
  if (EXCLUDED_INTENT_BUCKETS.has(normalized)) return null;

  return AUTOMATION_LABELS[normalized] ?? INTENT_BUCKET_LABELS[normalized] ?? "Otras";
}

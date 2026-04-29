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
  valuations: "Tasaciones",
  unspecified: "Sin especificar",
  rents: "Alquileres",
  sales: "Ventas",
};

export function normalizeAutomationToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function formatAutomationLabel(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return AUTOMATION_LABELS[normalizeAutomationToken(trimmed)] ?? trimmed;
}

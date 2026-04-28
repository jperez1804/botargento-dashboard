const AUTOMATION_LABELS: Record<string, string> = {
  sales_lead: "Consulta por compra",
  rental_lead: "Consulta por alquiler",
  owners_advisor: "Consulta de propietario",
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

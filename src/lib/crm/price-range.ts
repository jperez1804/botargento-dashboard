// The bot's snapshot stores the price range the lead picked as an object —
// { min, max, label, currency } (see the engine's inventory wizard) — while
// older snapshots and fixtures may hold plain text. Either way the panel shows
// one readable line: the label the lead saw, else "USD 120.000 – 160.000".

function money(n: number, currency: string, locale: string): string {
  const v = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
  return currency ? `${currency} ${v}` : v;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function priceRangeText(value: unknown, locale = "es-AR"): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value !== "object" || Array.isArray(value)) return "";

  const r = value as Record<string, unknown>;
  if (typeof r.label === "string" && r.label.trim()) return r.label.trim();
  const currency = typeof r.currency === "string" ? r.currency.trim().toUpperCase() : "";
  const min = num(r.min);
  const max = num(r.max);
  if (min !== null && max !== null) return `${money(min, currency, locale)} – ${money(max, currency, locale).replace(`${currency} `, "")}`;
  if (min !== null) return `Desde ${money(min, currency, locale)}`;
  if (max !== null) return `Hasta ${money(max, currency, locale)}`;
  return "";
}

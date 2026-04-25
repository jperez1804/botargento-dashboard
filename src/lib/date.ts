// Date formatting. All date display in the dashboard funnels through these
// helpers so CLIENT_LOCALE changes every axis label + tooltip at once.
//
// Postgres emits `day` columns in the tenant timezone already (the views use
// date_trunc at tenant tz when materializing). We parse them as UTC when
// converting back to Date to avoid the host JS runtime's local tz shifting
// the date by ±1 when formatting.

export function parseIsoDayUtc(isoDay: string): Date {
  const [y, m, d] = isoDay.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return new Date(isoDay);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatShortDate(isoDay: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(parseIsoDayUtc(isoDay));
}

export function formatLongDate(isoDay: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDayUtc(isoDay));
}

export function formatDateTime(iso: string, locale: string, timezone: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(iso));
}

// Locale-aware formatters. All dashboard numeric display goes through these
// so swapping CLIENT_LOCALE changes every number/percent at once.

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(Math.round(value));
}

// handoff_rate is stored as 0..1; Intl percent formatter multiplies by 100.
export function formatPercent(value: number, locale: string, fractionDigits = 1): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

// Signed percent delta for KPI cards. Returns the localized string including
// sign (+/-) — caller is responsible for the icon + color.
export function formatSignedPercent(value: number, locale: string, fractionDigits = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const body = new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(abs);
  return `${sign}${body}`;
}

/**
 * Compact duration in human terms. Tiers:
 *  - < 60 s  → "45 s"
 *  - < 1 h   → "12 min"
 *  - < 1 d   → "2 h 14 min" (minutes omitted when zero)
 *  - else    → "3 d 4 h"   (hours omitted when zero)
 *
 * `locale` is accepted to keep the call signature consistent with the other
 * formatters and to leave room for future per-locale unit translation; the
 * current output uses language-neutral abbreviations (s, min, h, d).
 */
export function formatDuration(seconds: number, locale: string): string {
  void locale;
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  if (totalHours < 24) {
    return remMinutes === 0 ? `${totalHours} h` : `${totalHours} h ${remMinutes} min`;
  }
  const totalDays = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  return remHours === 0 ? `${totalDays} d` : `${totalDays} d ${remHours} h`;
}

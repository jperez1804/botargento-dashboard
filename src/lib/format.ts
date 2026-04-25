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

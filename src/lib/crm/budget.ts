// Currencies a person may pick when typing a lead's budget by hand. The
// vertical can override; the default covers the Argentine market.

import type { CrmConfig } from "@/config/verticals/_types";
import { priceRangeText } from "@/lib/crm/price-range";

export const DEFAULT_CURRENCIES: ReadonlyArray<string> = ["USD", "ARS"];

export function crmCurrencies(config: CrmConfig): ReadonlyArray<string> {
  return config.currencies && config.currencies.length > 0 ? config.currencies : DEFAULT_CURRENCIES;
}

export type ManualBudget = { amount: number; currency: string };

// What the lead can spend. A person's figure wins; otherwise the amount of the
// latest real handoff of this opportunity that carried one, or — if the bot
// only captured a range — that range text.
export type LeadBudget = {
  amount: number | null;
  currency: string;
  text: string;
  source: "manual" | "bot";
};

const positive = (raw: unknown): number | null => {
  // NUMERIC arrives as a string from postgres.js.
  const n = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const upper = (raw: unknown) => String(raw ?? "").trim().toUpperCase();

/** Precedence: manual amount → bot amount → bot range. Pure. */
export function toBudget(
  manualAmount: unknown,
  manualCurrency: unknown,
  botAmount: unknown,
  botCurrency: unknown,
  rangeRaw: unknown,
): LeadBudget | null {
  const m = positive(manualAmount);
  if (m !== null) return { amount: m, currency: upper(manualCurrency), text: "", source: "manual" };
  const b = positive(botAmount);
  if (b !== null) return { amount: b, currency: upper(botCurrency), text: "", source: "bot" };
  const range = priceRangeText(rangeRaw);
  return range ? { amount: null, currency: "", text: range, source: "bot" } : null;
}

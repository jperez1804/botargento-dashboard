// Currencies a person may pick when typing a lead's budget by hand. The
// vertical can override; the default covers the Argentine market.

import type { CrmConfig } from "@/config/verticals/_types";

export const DEFAULT_CURRENCIES: ReadonlyArray<string> = ["USD", "ARS"];

export function crmCurrencies(config: CrmConfig): ReadonlyArray<string> {
  return config.currencies && config.currencies.length > 0 ? config.currencies : DEFAULT_CURRENCIES;
}

export type ManualBudget = { amount: number; currency: string };

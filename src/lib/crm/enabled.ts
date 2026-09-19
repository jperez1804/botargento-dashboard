// CRM-lite gating. Unlike the inbox, the CRM needs no tenant env: all its
// state lives in dashboard.* — the vertical capability plus a `crm` block on
// the config are enough.

import { verticalConfig } from "@/config/verticals";
import type { CrmConfig } from "@/config/verticals/_types";

export function crmConfig(): CrmConfig | null {
  const vertical = verticalConfig();
  return vertical.features?.crmTab && vertical.crm ? vertical.crm : null;
}

export function crmEnabled(): boolean {
  return crmConfig() !== null;
}

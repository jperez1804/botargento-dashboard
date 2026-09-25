// CRM-lite gating. Two keys, like the inbox (lib/inbox.ts): the VERTICAL
// declares the capability (features.crmTab + a `crm` block) and the TENANT
// turns it on (CRM_ENABLED in dashboard.env). Both are needed on purpose: the
// image is shared, and giving outbound-sales a `crm` block would otherwise
// light up Leads on every tenant of that vertical, including the ones that did
// not buy it.

import { verticalConfig } from "@/config/verticals";
import type { CrmConfig } from "@/config/verticals/_types";
import { env } from "@/lib/env";

export function crmTenantEnabled(): boolean {
  const v = env().CRM_ENABLED;
  return v === "1" || v === "true";
}

export function crmConfig(): CrmConfig | null {
  const vertical = verticalConfig();
  return vertical.features?.crmTab && vertical.crm && crmTenantEnabled() ? vertical.crm : null;
}

export function crmEnabled(): boolean {
  return crmConfig() !== null;
}

/**
 * The instant from which replies and handoffs open opportunities by
 * themselves. null = no cutoff (everything the tenant ever logged counts, which
 * is what client1 wanted). Set on a tenant that turns the CRM on with history
 * behind it and wants a clean board.
 */
export function crmSince(): Date | null {
  const v = env().CRM_SINCE;
  return v ? new Date(v) : null;
}

// Where a contact came from, as a label. Three families, one place to spell
// them: 'whatsapp' (wrote to the bot first), 'campaign' (WE wrote first —
// outbound, the number is in outreach.recipients), and the vertical's manual
// origins (registered by hand: phone call, walk-in, referral…). Persisted in
// dashboard.contacts.source.

import type { CrmConfig } from "@/config/verticals/_types";

export const SOURCE_WHATSAPP = "whatsapp";
export const SOURCE_CAMPAIGN = "campaign";

export function contactSourceLabel(config: CrmConfig, source: string): string {
  if (source === SOURCE_WHATSAPP || source === "") return config.labels.sourceWhatsapp;
  if (source === SOURCE_CAMPAIGN) return config.labels.sourceCampaign;
  return config.manualLeadSources.find((s) => s.key === source)?.label ?? source;
}

/** Registered by hand, i.e. not through a WhatsApp conversation of either direction. */
export function isManualSource(source: string): boolean {
  return source !== SOURCE_WHATSAPP && source !== SOURCE_CAMPAIGN && source !== "";
}

/** The origins the Resumen breaks people down by, in display order. */
export function sourceDefs(config: CrmConfig): ReadonlyArray<{ key: string; label: string }> {
  return [
    { key: SOURCE_WHATSAPP, label: config.labels.sourceWhatsapp },
    { key: SOURCE_CAMPAIGN, label: config.labels.sourceCampaign },
    ...config.manualLeadSources,
  ];
}

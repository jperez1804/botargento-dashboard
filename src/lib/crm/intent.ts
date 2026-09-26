// A lead's WhatsApp intent as the vertical's bucket ("Ventas", "Alquileres"…):
// the raw `automation.lead_log.intent` of the last inbound message, mapped
// through the same bucket rules the Panel uses (lib/automation-labels), then
// matched to a vertical IntentDef so filters work on a stable key.

import type { CrmConfig, IntentDef } from "@/config/verticals/_types";
import { verticalConfig } from "@/config/verticals";
import { formatBusinessIntentLabel } from "@/lib/automation-labels";

export type LeadIntent = { key: string; label: string };

/**
 * The rubros an opportunity can carry: the vertical's own `crm.kinds` when it
 * declares them (outbound: the prospect's business, not the Panel's intents),
 * otherwise the Panel's intents. Every CRM surface — board filter, new-lead
 * form, set-kind validation — reads this and never `verticalConfig().intents`
 * directly, so the two lists can differ.
 */
export function crmKinds(
  config?: CrmConfig | null,
  intents?: ReadonlyArray<IntentDef>,
): ReadonlyArray<LeadIntent> {
  if (config?.kinds) return config.kinds.map((k) => ({ key: k.key, label: k.label }));
  // Only now touch the tenant: a pure caller (tests) passes the intents in.
  const fallback = intents ?? verticalConfig().intents;
  return fallback.map((i) => ({ key: i.key, label: i.label }));
}

/** Pure: `intents` is the vertical's list. null when there is no usable intent. */
export function leadIntent(raw: string | null | undefined, intents: ReadonlyArray<IntentDef>): LeadIntent | null {
  // A raw token that IS one of the rubro keys ("proyecto_lead") needs no label
  // round-trip — which also keeps this independent of the running tenant.
  const exact = raw ? intents.find((i) => i.key.toLowerCase() === raw.toLowerCase()) : undefined;
  if (exact) return { key: exact.key, label: exact.label };
  const label = formatBusinessIntentLabel(raw);
  if (!label) return null;
  const def =
    intents.find((i) => i.label.toLowerCase() === label.toLowerCase()) ??
    intents.find((i) => i.key.toLowerCase() === label.toLowerCase());
  return def ? { key: def.key, label: def.label } : { key: label, label };
}

/**
 * The CRM rubro of a raw bot token, or null when it has none. A vertical that
 * declares its own `crm.kinds` is STRICT: a token that does not resolve to one
 * of them is not a rubro at all, so it opens nothing and does not count as
 * "Sin derivar". That is what keeps an architecture studio's supplier and
 * job-seeker intakes, and the bot's "unsupported_content" noise, off the board.
 * Without `kinds` (real-estate) the old behaviour stays: an unknown token is
 * "Otras".
 */
export function crmKindOf(
  raw: string | null | undefined,
  config?: CrmConfig | null,
  intents?: ReadonlyArray<IntentDef>,
): LeadIntent | null {
  const kind = leadIntent(raw, crmKinds(config, intents));
  if (!kind) return null;
  if (config?.kinds && !config.kinds.some((k) => k.key === kind.key)) return null;
  return kind;
}

/** Same, against the running tenant's CRM rubros. */
export function leadIntentForTenant(raw: string | null | undefined): LeadIntent | null {
  return leadIntent(raw, crmKinds());
}

/** Options for the intent filter: every bucket the vertical declares. */
export function intentOptions(intents: ReadonlyArray<IntentDef>): ReadonlyArray<LeadIntent> {
  return intents.map((i) => ({ key: i.key, label: i.label }));
}

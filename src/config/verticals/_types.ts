// Icon keys are strings (not lucide components) so that a VerticalConfig can
// cross the server/client boundary as data. The client Sidebar maps icon keys
// to lucide icons; add a new key here AND in Sidebar's ICON_MAP when you need
// a new icon.
export type NavIconKey =
  | "dashboard"
  | "conversations"
  | "handoffs"
  | "follow-up"
  | "providers"
  | "labor-pool"
  | "settings";

export type NavItemDef = {
  href: string;
  label: string;
  icon: NavIconKey;
};

export type IntentDef = {
  key: string; // Matches the value stored in automation.lead_log.intent
  label: string; // Display name (may differ from key for i18n or capitalization)
  /**
   * @deprecated Since PR 4 (refresh/04-charts) the dashboard assigns chart
   * colors by RANK from the locked categorical palette (--chart-1 ..
   * --chart-6) rather than per-intent identity. This field is kept on the
   * type for backward compatibility with existing config files but is no
   * longer read by any component. Safe to omit on new intent definitions
   * and to drop from existing configs in a cleanup pass.
   */
  color?: string;
  // Expected handoff rate (0..1) for this intent. Used to color per-intent
  // chips: green when actual is at or above target (within tolerance), red
  // when below. Omit to render the chip in neutral gray.
  desiredHandoffRate?: number;
  // Raw automation tokens that mark the END of this intent's flow (e.g.
  // "guided_sales_post_results_visit", "tasaciones_handoff"). Matched against
  // `automation.lead_log.route` — the bot writes terminal step names there
  // while keeping `intent` at the lead-type label for the whole conversation.
  terminalIntents?: ReadonlyArray<string>;
};

export type KpiFormat = "number" | "percent";

export type KpiDef = {
  id: "inbound" | "outbound" | "unique_contacts" | "handoff_rate";
  label: string;
  format: KpiFormat;
  // direction: whether a positive delta is "good". handoff_rate is good when
  // it trends DOWN; the other three are good when they trend UP.
  higherIsBetter: boolean;
};

// Tier of handoff urgency, used by /handoffs to badge + sort. Default 3 when
// unset (qualified lead, < 24h SLA). See docs/plec-arquitectos/handoff-priority.md
// for the operational matrix that anchors these values.
export type HandoffPriority = 1 | 2 | 3 | 4;

export type HandoffTargetDef = {
  // Substring match against automation.escalations.handoff_target; first hit wins.
  match: string;
  label: string;
  // Optional tier (1=urgent, 2=high value, 3=qualified default, 4=data capture).
  // Omitted ⇒ treated as 3 by the dashboard renderer.
  priority?: HandoffPriority;
};

// Mirror of IntentTouchMode in src/lib/queries/intents. Re-declared here so
// VerticalConfig has no dependency on the queries layer.
export type AttributionMode = "last" | "first" | "any";

export type AttributionOptionDef = {
  value: AttributionMode;
  label: string;
  helper: string;
  advanced?: boolean;
};

export type AttributionConfig = {
  controlLabel: string;
  controlTooltip: string;
  scopeNote: string;
  advancedToggleLabel: string;
  options: ReadonlyArray<AttributionOptionDef>;
  anyModeWarning: string;
  leadingIntentCaptionTemplate: string;
  handoffDisclaimerShort: string;
  handoffDisclaimerDetail: string;
  engagementDensityNote: string;
};

export type WindowDays = 7 | 14 | 28 | 56;

export type WindowOptionDef = {
  value: WindowDays;
  label: string;
};

export type WindowConfig = {
  controlLabel: string;
  scopeNote: string;
  options: ReadonlyArray<WindowOptionDef>;
  comparisonTemplate: string;
};

export type VerticalFeatures = {
  providersTab?: boolean;
  laborPoolTab?: boolean;
};

export type VerticalConfig = {
  key: string;
  label: string;
  nav: ReadonlyArray<NavItemDef>;
  kpis: ReadonlyArray<KpiDef>;
  intents: ReadonlyArray<IntentDef>;
  handoffTargets: ReadonlyArray<HandoffTargetDef>;
  attribution: AttributionConfig;
  windows: WindowConfig;
  features?: VerticalFeatures;
};

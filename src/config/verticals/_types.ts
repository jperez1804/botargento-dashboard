// Icon keys are strings (not lucide components) so that a VerticalConfig can
// cross the server/client boundary as data. The client Sidebar maps icon keys
// to lucide icons; add a new key here AND in Sidebar's ICON_MAP when you need
// a new icon.
export type NavIconKey = "dashboard" | "conversations" | "handoffs" | "follow-up";

export type NavItemDef = {
  href: string;
  label: string;
  icon: NavIconKey;
};

export type IntentDef = {
  key: string; // Matches the value stored in automation.lead_log.intent
  label: string; // Display name (may differ from key for i18n or capitalization)
  color: string; // Hex; used for the intents bar chart
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

export type HandoffTargetDef = {
  // Substring match against automation.escalations.target; first hit wins.
  match: string;
  label: string;
};

export type VerticalConfig = {
  key: string;
  label: string;
  nav: ReadonlyArray<NavItemDef>;
  kpis: ReadonlyArray<KpiDef>;
  intents: ReadonlyArray<IntentDef>;
  handoffTargets: ReadonlyArray<HandoffTargetDef>;
};

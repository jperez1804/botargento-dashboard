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
  // Expected handoff rate (0..1) for this intent. Used to color per-intent
  // chips: green when actual is at or above target (within tolerance), red
  // when below. Omit to render the chip in neutral gray.
  // Example: Ventas wants high handoff (sales agent takeover); Emprendimientos
  // is mostly informational so a low handoff rate is the desired outcome.
  desiredHandoffRate?: number;
  // Raw automation tokens that mark the END of this intent's flow (e.g.
  // "guided_sales_post_results_visit"). A contact who hits any of these tokens
  // is counted as "completed" for the corresponding bucket. Omit when no clear
  // terminal exists; the completion-rate UI renders "—" for that bucket.
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

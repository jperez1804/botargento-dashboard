// Icon keys are strings (not lucide components) so that a VerticalConfig can
// cross the server/client boundary as data. The client Sidebar maps icon keys
// to lucide icons; add a new key here AND in Sidebar's ICON_MAP when you need
// a new icon.
export type NavIconKey =
  | "dashboard"
  | "conversations"
  | "handoffs"
  | "follow-up"
  | "settings";

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
  // "guided_sales_post_results_visit", "tasaciones_handoff"). Matched against
  // `automation.lead_log.route` — the bot writes terminal step names there
  // while keeping `intent` at the lead-type label for the whole conversation.
  // A contact who hits any of these tokens is counted as "completed" for the
  // corresponding bucket. Omit when no clear terminal exists; the
  // completion-rate UI renders "—" for that bucket.
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

// Mirror of IntentTouchMode in src/lib/queries/intents. Re-declared here so
// VerticalConfig has no dependency on the queries layer.
export type AttributionMode = "last" | "first" | "any";

export type AttributionOptionDef = {
  value: AttributionMode;
  // Client-friendly product label (e.g. "Último interés"). Replaces the older
  // analyst-facing strings like "Último contacto".
  label: string;
  // Helper sentence shown next to the option and used for chart summary copy.
  helper: string;
  // First-touch and any-touch modes are advanced analysis. The selector keeps
  // them behind a disclosure so the default view stays decision-oriented.
  advanced?: boolean;
};

export type AttributionConfig = {
  // Visible label on the selector itself (e.g. "Cómo contar contactos").
  controlLabel: string;
  // Long explanation surfaced via the info tooltip next to the control.
  controlTooltip: string;
  // Scope note rendered beside/below the selector explaining which surfaces
  // it actually changes vs which stay fixed.
  scopeNote: string;
  // Label for the disclosure that hides advanced modes.
  advancedToggleLabel: string;
  options: ReadonlyArray<AttributionOptionDef>;
  // Inline warning when "any" is selected: a contact may appear in multiple
  // categories so totals can exceed `Contactos únicos`.
  anyModeWarning: string;
  // Caption template for the `Intención líder` KPI card. `{label}` is replaced
  // with the active option's `label`. Surfaces the hidden coupling between
  // the card and the selector.
  leadingIntentCaptionTemplate: string;
  // Short, always-visible disclaimer at the handoff-rate chip strip.
  handoffDisclaimerShort: string;
  // Long disclaimer, hidden behind a "Ver detalle" toggle.
  handoffDisclaimerDetail: string;
  // One-line note above the per-intent engagement-density chip strip — the
  // volume bars don't change, but the per-contact denominator does.
  engagementDensityNote: string;
};

// Allowed analytics-window sizes for the global `?window=` selector on the
// overview page. Hardcoded set so the param parser can validate by literal
// equality and downstream queries are never asked for arbitrary day counts.
export type WindowDays = 7 | 14 | 28 | 56;

export type WindowOptionDef = {
  value: WindowDays;
  label: string; // e.g. "7 días"
};

export type WindowConfig = {
  // Visible label next to the chip group (e.g. "Período").
  controlLabel: string;
  // One-line scope note explaining which surfaces follow this selector and
  // which keep their own window (the heatmap and the follow-up queue do).
  scopeNote: string;
  options: ReadonlyArray<WindowOptionDef>;
  // Subline template under the page masthead; `{N}` is replaced with the
  // active window size. Example: "Comparado con los {N} días anteriores."
  comparisonTemplate: string;
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
};

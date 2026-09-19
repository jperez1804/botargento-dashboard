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
  | "campaigns"
  | "inbox"
  | "leads"
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
  // Read-only outbound campaign observability (/campaigns). Reads outreach.v_*
  // views; only verticals with an outreach.* schema (e.g. outbound-sales) enable it.
  campaignsTab?: boolean;
  // The Panel "Resueltas por el bot" (self-resolution) KPI. Default-on; set false
  // for verticals where a handoff IS the goal (outbound-sales), so the metric
  // doesn't read backwards.
  botResolutionKpi?: boolean;
  // Two-way inbox (/inbox): reply by hand + pause the bot per conversation.
  // The vertical flag is only the capability; actual per-tenant activation
  // additionally requires N8N_INBOX_WEBHOOK_URL/TOKEN in the tenant env (see
  // inboxEnabled() in lib/inbox) — tenants without the n8n inbox webhook never
  // render the tab even on this vertical.
  inboxTab?: boolean;
  // CRM-lite (/leads + the CRM card on /conversations/[waId]): stage, owner,
  // activities and reminders per lead. Requires a `crm` block on the config
  // (see crmEnabled() in lib/crm/enabled). Needs no tenant env: all state lives
  // in dashboard.*.
  crmTab?: boolean;
};

// ── CRM-lite ────────────────────────────────────────────────────────────────

// Visual tone of a stage chip. Maps to the semantic palette in LeadStageChip —
// not a brand color.
export type CrmStageTone = "neutral" | "info" | "progress" | "good" | "bad";

export type CrmStageDef = {
  key: string; // Persisted in dashboard.lead_state.stage — never rename a live key.
  label: string;
  tone: CrmStageTone;
  // Closed stages (won / lost): sticky, no inactivity timer, no "por vencer".
  terminal?: boolean;
  // Only a person can move a lead here; the bot never derives it.
  manualOnly?: boolean;
};

// Activities a person logs by hand from the lead card.
export type CrmActivityKind = "note" | "call" | "visit" | "meeting";

// Everything that lands in dashboard.lead_events.kind.
export type CrmEventKind =
  | CrmActivityKind
  | "stage_change"
  | "assignment"
  | "reminder_set"
  | "reminder_done"
  | "contact";

export type CrmLabels = {
  nav: string;
  pageKicker: string;
  pageTitle: string;
  viewList: string;
  viewBoard: string;
  searchPlaceholder: string;
  filterAllStages: string;
  filterAllOwners: string;
  filterMine: string;
  filterAtRisk: string;
  filterOverdue: string;
  filterUnassigned: string;
  columnContact: string;
  columnStage: string;
  columnOwner: string;
  columnLastActivity: string;
  columnNextStep: string;
  cardTitle: string;
  stageLabel: string;
  ownerLabel: string;
  nextStepLabel: string;
  unassigned: string;
  takeLead: string;
  takeLeadConfirm: string;
  moveTo: string;
  setReminder: string;
  reminderNotePlaceholder: string;
  markDone: string;
  addActivity: string;
  activityPlaceholder: string;
  activityTitle: string;
  remindersTitle: string;
  qualificationTitle: string;
  emptyLeads: string;
  emptyActivity: string;
  emptyColumn: string;
  save: string;
  cancel: string;
  saved: string;
  whenLabel: string;
  // Templates: {date}, {reason}, {n}, {days} are substituted at render time.
  autoStageHint: string;
  lostSinceTemplate: string;
  atRiskTemplate: string;
  daysInactiveTemplate: string;
  bannerAtRiskTemplate: string;
  bannerAtRiskOne: string;
  bannerOverdueTemplate: string;
  bannerOverdueOne: string;
  reminderOverdueTemplate: string;
  reminderUpcomingTemplate: string;
  lostReasonLabel: string;
  lostReasons: ReadonlyArray<string>;
  lostReasonAuto: { opt_out: string; inactivity: string };
  eventKinds: Record<CrmEventKind, string>;
  errors: Record<string, string>;
};

// A qualification datum the bot captured, shown on the lead card. "escalation"
// reads a column of the latest real handoff (automation.escalations); "snapshot"
// reads a key of automation.session_memory.qualification_snapshot_json. Empty
// values are hidden, so listing fields a flow never fills is harmless.
export type CrmQualificationField = {
  source: "escalation" | "snapshot";
  key: string;
  label: string;
  // money: `key` is the amount, `currencyKey` (same source) the currency.
  // links: newline/comma separated URLs rendered as links.
  format?: "text" | "money" | "links";
  currencyKey?: string;
};

export type CrmConfig = {
  // Order defines progression rank: an automatic signal can only push a lead
  // FORWARD in this list, never back.
  stages: ReadonlyArray<CrmStageDef>;
  // Which stage keys the bot's signals map to.
  autoStages: { new: string; contacted: string; qualified: string; lost: string };
  // Days without activity before a non-terminal lead becomes "perdido" (auto,
  // reversible), and how many days before that it shows up as "por vencer".
  autoLostDays: number;
  warnDays: number;
  qualificationFields: ReadonlyArray<CrmQualificationField>;
  labels: CrmLabels;
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
  crm?: CrmConfig;
};

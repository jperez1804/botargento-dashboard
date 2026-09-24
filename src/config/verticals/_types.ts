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
  // One or two sentences for the Guía tab: what the stage means and what
  // puts a lead there.
  help?: string;
};

// Manual priority a person sets on a lead. Persisted in
// dashboard.lead_state.priority ('' = none) — never rename a live key.
export type CrmPriorityKey = "alta" | "media" | "baja";

// Activities a person logs by hand from the lead card.
export type CrmActivityKind = "note" | "call" | "visit" | "meeting";

// Everything that lands in dashboard.lead_events.kind.
export type CrmEventKind =
  | CrmActivityKind
  | "stage_change"
  | "assignment"
  | "reminder_set"
  | "reminder_done"
  | "contact"
  // A person registered a lead that did not come in through WhatsApp.
  | "created"
  // A person set or cleared the manual priority.
  | "priority"
  // A person typed (or cleared) the budget by hand.
  | "budget"
  // A person opened an opportunity by hand. The bot's ones are recorded by
  // the opportunity's own opened_at, not by an event.
  | "opened"
  // A person corrected an opportunity's rubro or title.
  | "kind_change";

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
  takenToast: string; // "Es tuyo" — the toast after Tomar, with Deshacer
  ownerLockedHint: string; // asesor on a colleague's lead: only an admin reassigns
  moveTo: string;
  setReminder: string;
  reminderNotePlaceholder: string;
  markDone: string;
  addActivity: string;
  addActivityTemplate: string; // {kind} — "Guardar llamada"
  activityKindLabel: string;
  activityPlaceholders: Record<CrmActivityKind, string>;
  shortcutHintTemplate: string; // {keys} — "Ctrl+↵ para guardar"
  moveToStageOfferTemplate: string; // {stage} — toast action after a visit is logged
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
  autoStageHint: string; // one line under the stage row
  autoStageDetail: string; // the full explanation, as the chip's tooltip
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

  // Budget + time in stage (board, list)
  columnBudget: string;
  columnSource: string;
  sourceWhatsapp: string;
  daysInStageTemplate: string; // {days}
  daysInStageToday: string;

  // Activity tab
  viewActivity: string;
  filterAllKinds: string;
  filterAllPeople: string;

  // Manual leads
  newLead: string;
  newLeadTitle: string;
  newLeadHint: string;
  nameLabel: string;
  phoneLabel: string;
  phonePlaceholder: string;
  phonePreviewTemplate: string; // {phone}
  sourceLabel: string;
  noteLabel: string;
  createLead: string;
  leadCreated: string;
  openExisting: string;
  noConversationTitle: string;
  noConversationBody: string;
  openWhatsapp: string;
  manualOriginTemplate: string; // {source}
  manualByTemplate: string; // {who} {date}

  // Manual priority (card, list, ⋯ menu, lead card, filter)
  priority: {
    label: string;
    none: string;
    names: Record<CrmPriorityKey, string>;
    filterLabel: string;
  };

  // Resumen tab: fixed 7-day window, Jira-style indicators.
  summary: {
    view: string;
    windowTemplate: string; // {days}
    closed: string;
    active: string;
    new: string;
    dueSoon: string;
    overdueCaptionTemplate: string; // {n}
    overdueCaptionOne: string;
    noOverdueCaption: string;
    stagesTitle: string;
    stagesDescription: string;
    priorityTitle: string;
    priorityDescription: string;
    workloadTitle: string;
    workloadDescription: string;
    sourcesTitle: string;
    sourcesDescription: string;
    totalUnit: string;
    empty: string;
  };

  // Manual budget (lead card) — wins over what the bot captured.
  budget: {
    label: string;
    none: string;
    amountLabel: string;
    currencyLabel: string;
    amountPlaceholder: string;
    save: string;
    clear: string;
    clearHint: string;
    fromBot: string;
  };

  // Filters
  clearFilters: string;
  intentLabel: string;
  filterAllIntents: string;
  intentNone: string; // Nuevo lead: the "no intent" option

  // Reminder callout: {relative} = "hace 2 días" / "mañana"
  reminderOverdueRelativeTemplate: string;
  reminderDueRelativeTemplate: string;
  reminderChange: string;
  // Reminder editor: preset chips, then note, then date + time (09:00 default).
  reminderPresets: Record<"tomorrow" | "in3days" | "nextWeek" | "custom", string>;
  dateLabel: string;
  timeLabel: string;

  // "Lo que captó el bot": summary paragraph, chips, and the rest folded.
  showAllTemplate: string; // {n}
  showLess: string;

  // Opportunities: a person can have several commercial processes over time,
  // so a lead card is one of them and the person's card lists them all.
  opportunity: {
    listTitle: string;
    newButton: string;
    dialogTitle: string;
    dialogHint: string;
    kindLabel: string;
    kindNone: string;
    titleLabel: string;
    titlePlaceholder: string;
    create: string;
    createdToast: string;
    ofTotalTemplate: string; // {n} {total}
    ordinalTemplate: string; // {n} — names one opportunity ("5ª")
    openedTemplate: string; // {date}
    closedTemplate: string; // {date}
    openedByBot: string;
    // A rubro nobody is working showed up in the conversation.
    newIntentTemplate: string; // {kind}
    openFromIntent: string;
    // Conversations that never reached a handoff.
    underivedTitle: string;
    underivedCountTemplate: string; // {n}
    underivedCountOne: string;
    underivedHint: string;
    underivedEmpty: string;
    allConversations: string;
    // Lista, grouped by contact.
    groupByContact: string;
    oneOpportunity: string;
    manyOpportunities: string; // {n}
  };

  // Lead detail modal
  openConversation: string;
  close: string;

  // Inline editing (Details list)
  editFieldTemplate: string; // {field}
  addValue: string;
  confirm: string;

  // Board (round 7)
  filterToday: string;
  filterGroupMine: string; // kicker over Hoy · Mis leads
  filterGroupUrgency: string; // kicker over Vencidos · Se pierden pronto · Sin responsable
  moreInListTemplate: string; // {n} — under a capped board column, links to the list
  attentionOverdueTemplate: string; // {relative}
  attentionTodayTemplate: string; // {time}
  attentionAtRiskTemplate: string; // {date}
  attentionUpcomingTemplate: string; // {relative}
  expandColumnTemplate: string; // {stage}
  collapseColumn: string;
  undo: string;
  markLost: string;
  markLostTitleTemplate: string; // {name}
  movedToastTemplate: string; // {name} {stage}
  assignedToastTemplate: string; // {name} {owner}
  priorityToastTemplate: string; // {name} {priority}
  emptyFiltered: string;
  emptyFirstRun: string;

  // Guía tab: how the stages and the rules work, in the vertical's words.
  guide: {
    view: string;
    title: string;
    intro: string;
    stagesTitle: string;
    moverBot: string;
    moverPerson: string;
    moverBoth: string;
    autoNew: string;
    autoContacted: string;
    autoQualified: string;
    autoLostTemplate: string; // {days}
    manualOnlyNote: string;
    rulesTitle: string;
    inactivityRuleTemplate: string; // {days} {warn} {lost}
    inactivityReversible: string;
    activityTitle: string;
    activityIntro: string;
    activityMessages: string;
    remindersTitle: string;
    remindersBody: string;
    priorityTitle: string;
    priorityBody: string;
    priorityMeaning: Record<CrmPriorityKey, string>;
    sourcesTitle: string;
    sourcesBody: string;
    // Opportunities: what opens one, and where the rest end up.
    opportunitiesTitle: string;
    opportunitiesIntro: string;
    opportunitiesHandoff: string;
    opportunitiesSameKind: string;
    opportunitiesMessages: string;
    opportunitiesManual: string;
    opportunitiesUnderived: string;
  };
};

// Where a lead that did not come through WhatsApp came from ("Portal
// inmobiliario", "Referido"…). `key` is persisted in dashboard.manual_leads.
export type CrmLeadSourceDef = { key: string; label: string };

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
  // Raw value (lower-cased) → label, for keys the bot stores as tokens
  // ("rents" → "Alquileres"). Unmapped values show as they are.
  valueLabels?: Record<string, string>;
  // Where the field shows on the lead card: `summary` as a paragraph on top
  // (the bot's transcript summary), `chip` on the one-line chip strip, and
  // `detail` (default) inside "Ver todo".
  display?: "summary" | "chip" | "detail";
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
  // Origins offered when someone registers a lead by hand. Empty = no manual
  // lead creation for this vertical.
  manualLeadSources: ReadonlyArray<CrmLeadSourceDef>;
  // Currencies offered when a person types a budget. Default: USD, ARS.
  currencies?: ReadonlyArray<string>;
  // Activities that imply a stage: logging a `visit` on a lead that is still
  // before the "visita" stage makes the composer offer the move.
  activityStages?: Partial<Record<CrmActivityKind, string>>;
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

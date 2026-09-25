// The single source of truth for "what stage is this lead in". Pure: no DB, no
// env, no clock — `now` is an argument so the unit tests pin it and Server
// Components compute it once per request.
//
// Automatic stages are DERIVED from what the bot and the inbox already record
// in automation.* / dashboard.lead_events; only a person's decision is
// persisted (dashboard.opportunities.stage). Precedence, in order:
//   1. Opt-out (outreach.suppression) always wins → perdido, not reversible.
//   2. A manual terminal stage (cerrado / perdido) is sticky.
//   3. A manual non-terminal stage holds its position; a LATER bot signal may
//      only push the lead FORWARD (higher rank in config.stages), never back.
//   4. No manual stage → the automatic one (calificado > contactado > nuevo).
//   5. A non-terminal lead with no activity for autoLostDays → perdido
//      (automatic, reversible: any manual stage change restarts the clock).

import type { CrmConfig, CrmEventKind, CrmPriorityKey } from "@/config/verticals/_types";
import { parsePriority } from "@/lib/crm/priority";

const DAY_MS = 86_400_000;

// lead_events kinds that count as activity for the inactivity clock. Assigning
// an owner or scheduling a reminder is not contacting the lead, so they don't
// reset it. SQL in lib/queries/leads.ts filters with this same list.
export const ACTIVITY_EVENT_KINDS: ReadonlyArray<CrmEventKind> = [
  "note",
  "call",
  "visit",
  "meeting",
  "stage_change",
  "contact",
  // Registering a lead by hand starts its clock (it has no WhatsApp message).
  "created",
  // Opening an opportunity by hand does too.
  "opened",
];

export type LeadSignals = {
  firstSeen: Date | null;
  lastMessageAt: Date | null; // Any WhatsApp message, either direction.
  lastHandoffAt: Date | null; // Latest real handoff (runtime errors excluded).
  lastHumanContactAt: Date | null; // sent_by='human' or an inbox 'contact' event.
  optedOutAt: Date | null;
  lastCrmActivityAt: Date | null; // MAX(occurred_at) over ACTIVITY_EVENT_KINDS.
};

export type LeadStateRow = {
  stage: string | null;
  stageChangedAt: Date | null;
  lostReason: string;
  ownerEmail: string | null;
  nextActionAt: Date | null;
  nextActionNote: string;
  nextActionDoneAt: Date | null;
  // When n8n pushed this reminder to the owner's WhatsApp. The panel only ever
  // READS this column (docs/crm-oportunidades.md): it is the single field n8n
  // writes in dashboard.*, and re-scheduling clears it so the notice re-arms.
  nextActionNotifiedAt: Date | null;
  priority: string; // '' | alta | media | baja (validated by parsePriority)
  // When this opportunity started. An opportunity opened by hand has no
  // WhatsApp message of its own, so this is the floor for its stage date and
  // its inactivity clock.
  openedAt: Date;
  // When an advisor closed it (terminal stage). NULL = open.
  closedAt: Date | null;
};

export type LostInfo = {
  at: Date;
  reason: "opt_out" | "inactivity" | "manual";
  detail: string; // Free-text motive for manual losses; '' otherwise.
  reversible: boolean;
};

export type ReminderStatus = "overdue" | "upcoming" | "scheduled" | "done";

export type EffectiveLead = {
  stage: string;
  source: "auto" | "manual";
  stageSince: Date | null;
  lastActivityAt: Date | null;
  daysInactive: number | null;
  lost: LostInfo | null;
  atRisk: { lostOn: Date; daysLeft: number } | null;
  reminder: {
    at: Date;
    note: string;
    status: ReminderStatus;
    // null = the WhatsApp notice has not gone out (yet, or ever).
    notifiedAt: Date | null;
  } | null;
  owner: string | null;
  // Manual priority; setting it is not activity (same rule as assigning).
  priority: CrmPriorityKey | null;
  // Persisted close (an advisor moved it to a terminal stage). A lead that is
  // only lost by inactivity stays open and reversible, so this stays null.
  closedAt: Date | null;
};

function maxDate(...dates: Array<Date | null | undefined>): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (d && (!best || d.getTime() > best.getTime())) best = d;
  }
  return best;
}

function autoStage(
  signals: LeadSignals,
  config: CrmConfig,
  openedAt: Date | null,
): { stage: string; at: Date | null } {
  if (signals.lastHandoffAt) {
    return { stage: config.autoStages.qualified, at: signals.lastHandoffAt };
  }
  if (signals.lastHumanContactAt) {
    return { stage: config.autoStages.contacted, at: signals.lastHumanContactAt };
  }
  return { stage: config.autoStages.new, at: signals.firstSeen ?? openedAt };
}

export function deriveLead(
  signals: LeadSignals,
  state: LeadStateRow | null,
  config: CrmConfig,
  now: Date,
): EffectiveLead {
  const rank = (key: string) => config.stages.findIndex((s) => s.key === key);
  const isTerminal = (key: string) =>
    config.stages.find((s) => s.key === key)?.terminal === true;

  // A manual stage whose key no longer exists in the config is ignored rather
  // than rendered as an unknown chip.
  const manual =
    state?.stage && rank(state.stage) >= 0
      ? { stage: state.stage, at: state.stageChangedAt }
      : null;
  const auto = autoStage(signals, config, state?.openedAt ?? null);

  let stage: string;
  let source: "auto" | "manual";
  let stageSince: Date | null;
  if (!manual) {
    ({ stage } = auto);
    source = "auto";
    stageSince = auto.at;
  } else if (isTerminal(manual.stage)) {
    ({ stage } = manual);
    source = "manual";
    stageSince = manual.at;
  } else {
    const botMovedAfter =
      auto.at !== null && (manual.at === null || auto.at.getTime() > manual.at.getTime());
    const pushesForward = rank(auto.stage) > rank(manual.stage);
    if (botMovedAfter && pushesForward) {
      ({ stage } = auto);
      source = "auto";
      stageSince = auto.at;
    } else {
      ({ stage } = manual);
      source = "manual";
      stageSince = manual.at;
    }
  }

  // Opening the opportunity starts its clock: one opened by hand has no
  // WhatsApp message of its own and must not be born "por vencer".
  const lastActivityAt = maxDate(
    signals.lastMessageAt,
    signals.lastCrmActivityAt,
    state?.stageChangedAt,
    state?.openedAt,
  );
  const daysInactive =
    lastActivityAt === null
      ? null
      : Math.max(0, Math.floor((now.getTime() - lastActivityAt.getTime()) / DAY_MS));

  let lost: LostInfo | null = null;
  let atRisk: EffectiveLead["atRisk"] = null;

  if (signals.optedOutAt) {
    stage = config.autoStages.lost;
    source = "auto";
    stageSince = signals.optedOutAt;
    lost = { at: signals.optedOutAt, reason: "opt_out", detail: "", reversible: false };
  } else if (stage === config.autoStages.lost && source === "manual") {
    lost = {
      at: stageSince ?? now,
      reason: "manual",
      detail: state?.lostReason ?? "",
      reversible: true,
    };
  } else if (!isTerminal(stage) && lastActivityAt !== null) {
    const lostOn = new Date(lastActivityAt.getTime() + config.autoLostDays * DAY_MS);
    if (now.getTime() >= lostOn.getTime()) {
      stage = config.autoStages.lost;
      source = "auto";
      stageSince = lostOn;
      lost = { at: lostOn, reason: "inactivity", detail: "", reversible: true };
    } else {
      const daysLeft = Math.ceil((lostOn.getTime() - now.getTime()) / DAY_MS);
      if (daysLeft <= config.warnDays) atRisk = { lostOn, daysLeft };
    }
  }

  let reminder: EffectiveLead["reminder"] = null;
  if (state?.nextActionAt) {
    const at = state.nextActionAt;
    const status: ReminderStatus = state.nextActionDoneAt
      ? "done"
      : at.getTime() <= now.getTime()
        ? "overdue"
        : at.getTime() - now.getTime() <= config.warnDays * DAY_MS
          ? "upcoming"
          : "scheduled";
    reminder = {
      at,
      note: state.nextActionNote,
      status,
      notifiedAt: state.nextActionNotifiedAt,
    };
  }

  return {
    stage,
    source,
    stageSince,
    lastActivityAt,
    daysInactive,
    lost,
    atRisk,
    reminder,
    owner: state?.ownerEmail ?? null,
    priority: parsePriority(state?.priority),
    closedAt: state?.closedAt ?? null,
  };
}

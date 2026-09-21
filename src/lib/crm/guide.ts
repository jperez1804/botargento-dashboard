// Content model for the Guía tab: which stages exist, who moves a lead into
// each one and what triggers it, plus the automatic rules — all derived from
// the vertical's CrmConfig so every vertical documents itself. Pure.

import type { CrmConfig, CrmStageTone } from "@/config/verticals/_types";
import { ACTIVITY_EVENT_KINDS } from "@/lib/crm/effective-stage";
import { fillTemplate } from "@/lib/crm/view-model";

export type StageMover = "bot" | "person" | "both";

export type StageGuideRow = {
  key: string;
  label: string;
  tone: CrmStageTone;
  mover: StageMover;
  moverLabel: string;
  trigger: string; // What puts a lead here (from labels / autoLostTemplate).
  help: string; // The stage's own description (CrmStageDef.help), '' if none.
  manualOnly: boolean;
  terminal: boolean;
};

export function buildStageGuide(config: CrmConfig): StageGuideRow[] {
  const g = config.labels.guide;
  const auto = config.autoStages;
  const moverLabel: Record<StageMover, string> = {
    bot: g.moverBot,
    person: g.moverPerson,
    both: g.moverBoth,
  };
  return config.stages.map((s) => {
    let mover: StageMover;
    let trigger: string;
    if (s.key === auto.lost) {
      mover = "both";
      trigger = fillTemplate(g.autoLostTemplate, { days: config.autoLostDays });
    } else if (s.key === auto.new) {
      mover = "bot";
      trigger = g.autoNew;
    } else if (s.key === auto.contacted) {
      mover = "bot";
      trigger = g.autoContacted;
    } else if (s.key === auto.qualified) {
      mover = "bot";
      trigger = g.autoQualified;
    } else if (s.manualOnly) {
      mover = "person";
      trigger = g.manualOnlyNote;
    } else {
      mover = "both";
      trigger = "";
    }
    return {
      key: s.key,
      label: s.label,
      tone: s.tone,
      mover,
      moverLabel: moverLabel[mover],
      trigger,
      help: s.help ?? "",
      manualOnly: s.manualOnly === true,
      terminal: s.terminal === true,
    };
  });
}

export type GuideRules = {
  inactivity: string;
  reversible: string;
  activityKinds: string[]; // Labels of the event kinds that reset the clock.
};

export function buildGuideRules(config: CrmConfig): GuideRules {
  const g = config.labels.guide;
  const lost = config.stages.find((s) => s.key === config.autoStages.lost)?.label ?? config.autoStages.lost;
  const vars = { days: config.autoLostDays, warn: config.warnDays, lost };
  return {
    inactivity: fillTemplate(g.inactivityRuleTemplate, vars),
    reversible: fillTemplate(g.inactivityReversible, vars),
    activityKinds: ACTIVITY_EVENT_KINDS.map((k) => config.labels.eventKinds[k]),
  };
}

// Turns the derived lead views into the board's columns: one per stage, with
// the total, the per-currency budget sum and the capped list of cards.

import type { CrmConfig } from "@/config/verticals/_types";
import { sumBudgets, type LeadView } from "@/lib/crm/view-model";
import type { LeadBudget } from "@/lib/queries/leads";
import type { BoardColumn } from "@/components/dashboard/LeadsBoard";

// Board columns show the most recent cards; the header keeps the full count.
const BOARD_CARDS_PER_COLUMN = 50;
const BOARD_LOST_CARDS = 20;

export type LeadViewRow = {
  waId: string;
  displayName: string;
  budget: LeadBudget | null;
  sourceLabel: string | null;
  intentLabel: string | null;
  view: LeadView;
};

export function buildBoardColumns(
  views: ReadonlyArray<LeadViewRow>,
  crm: CrmConfig,
  locale: string,
): BoardColumn[] {
  return crm.stages.map((s) => {
    const inStage = views.filter((v) => v.view.stageKey === s.key);
    const cap = s.key === crm.autoStages.lost ? BOARD_LOST_CARDS : BOARD_CARDS_PER_COLUMN;
    return {
      key: s.key,
      label: s.label,
      tone: s.tone,
      total: inStage.length,
      budgetTotal: sumBudgets(
        inStage.map((v) => v.budget),
        locale,
      ),
      cards: inStage.slice(0, cap).map((v) => ({
        waId: v.waId,
        displayName: v.displayName,
        stageKey: v.view.stageKey,
        auto: v.view.auto,
        ownerEmail: v.view.ownerEmail,
        ownerLabel: v.view.ownerLabel,
        statusText: v.view.statusText,
        statusTone: v.view.statusTone,
        reminderText:
          v.view.reminder && v.view.reminder.status !== "done" ? v.view.reminder.text : null,
        reminderNote:
          v.view.reminder && v.view.reminder.status !== "done" && v.view.reminder.note
            ? v.view.reminder.note
            : null,
        reminderOverdue: v.view.reminder?.status === "overdue",
        lastActivity: v.view.lastActivityRelative,
        budgetText: v.view.budgetText,
        daysInStage: v.view.daysInStageText,
        sourceLabel: v.sourceLabel,
        priority: v.view.priority,
        intentLabel: v.intentLabel,
      })),
    };
  });
}

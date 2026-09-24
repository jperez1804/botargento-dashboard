// Turns the derived lead views into the board's columns: one per stage, with
// the total, the per-currency budget sum and the capped list of cards.

import type { CrmConfig } from "@/config/verticals/_types";
import { sumBudgets, type LeadView } from "@/lib/crm/view-model";
import { buildStageGuide } from "@/lib/crm/guide";
import type { Attention } from "@/lib/crm/attention";
import type { LeadBudget } from "@/lib/queries/leads";
import type { BoardColumn } from "@/components/dashboard/LeadsBoard";

// Board columns show the most recent cards; the header keeps the full count.
const BOARD_CARDS_PER_COLUMN = 50;
const BOARD_LOST_CARDS = 20;

export type LeadViewRow = {
  id: number;
  waId: string;
  displayName: string;
  // Which of the person's opportunities this is, and how many they have.
  seq: number;
  ofTotal: number;
  title: string;
  budget: LeadBudget | null;
  sourceLabel: string | null;
  intentLabel: string | null;
  // Rubro of an enquiry nobody is working yet: a hint, not an opening.
  newIntentKey: string | null;
  newIntentLabel: string | null;
  attention: Attention | null;
  view: LeadView;
};

export function buildBoardColumns(
  views: ReadonlyArray<LeadViewRow>,
  crm: CrmConfig,
  locale: string,
  // Lista URL for one stage, keeping the current filters.
  listHrefFor: (stageKey: string) => string,
): BoardColumn[] {
  // Budget totals mean something once the bot has qualified the lead; under
  // Nuevo/Contactado (and Perdido) they are noise.
  const qualifiedRank = crm.stages.findIndex((s) => s.key === crm.autoStages.qualified);
  const guide = buildStageGuide(crm);
  return crm.stages.map((s, rank) => {
    const inStage = views.filter((v) => v.view.stageKey === s.key);
    const cap = s.key === crm.autoStages.lost ? BOARD_LOST_CARDS : BOARD_CARDS_PER_COLUMN;
    const showTotal = rank >= qualifiedRank && s.key !== crm.autoStages.lost;
    return {
      key: s.key,
      label: s.label,
      tone: s.tone,
      total: inStage.length,
      moverLabel: guide.find((g) => g.key === s.key)?.moverLabel ?? "",
      manualOnly: s.manualOnly === true,
      terminal: s.terminal === true,
      moreHref: listHrefFor(s.key),
      budgetTotal: showTotal
        ? sumBudgets(
            inStage.map((v) => v.budget),
            locale,
          )
        : null,
      cards: inStage.slice(0, cap).map((v) => ({
        id: v.id,
        waId: v.waId,
        displayName: v.displayName,
        seq: v.seq,
        ofTotal: v.ofTotal,
        title: v.title,
        stageKey: v.view.stageKey,
        auto: v.view.auto,
        ownerEmail: v.view.ownerEmail,
        ownerLabel: v.view.ownerLabel,
        attention: v.attention,
        lastActivity: v.view.lastActivityRelative,
        budgetText: v.view.budgetText,
        daysInStage: v.view.daysInStageText,
        sourceLabel: v.sourceLabel,
        priority: v.view.priority,
        intentLabel: v.intentLabel,
        newIntentKey: v.newIntentKey,
        newIntentLabel: v.newIntentLabel,
      })),
    };
  });
}

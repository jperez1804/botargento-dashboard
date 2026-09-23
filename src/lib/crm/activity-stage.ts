// After a person logs an activity that implies a stage ("Visita" logged while
// the lead is still Calificado), the composer offers the move. The vertical
// says which activity maps to which stage (config.activityStages); the offer
// only makes sense when it would push the lead forward from an open stage.

import type { CrmActivityKind, CrmConfig } from "@/config/verticals/_types";

export type StageOffer = { key: string; label: string };

export function stageOfferForActivity(
  config: CrmConfig,
  currentStage: string,
  kind: CrmActivityKind,
): StageOffer | null {
  const targetKey = config.activityStages?.[kind];
  if (!targetKey) return null;
  const targetRank = config.stages.findIndex((s) => s.key === targetKey);
  const currentRank = config.stages.findIndex((s) => s.key === currentStage);
  if (targetRank < 0 || currentRank < 0) return null;
  if (config.stages[currentRank]?.terminal) return null;
  if (currentRank >= targetRank) return null;
  return { key: targetKey, label: config.stages[targetRank]!.label };
}

/** One offer per activity kind, for a lead in `currentStage`. */
export function stageOffers(
  config: CrmConfig,
  currentStage: string,
): Partial<Record<CrmActivityKind, StageOffer>> {
  const out: Partial<Record<CrmActivityKind, StageOffer>> = {};
  for (const kind of Object.keys(config.activityStages ?? {}) as CrmActivityKind[]) {
    const offer = stageOfferForActivity(config, currentStage, kind);
    if (offer) out[kind] = offer;
  }
  return out;
}

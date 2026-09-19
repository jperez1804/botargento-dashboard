"use client";

// Stage picker on the lead card. Any stage can be set by hand (manualOnly ones
// ONLY by hand); choosing the lost stage asks for a motive first. Writes go
// through /api/leads/set-stage (dashboard.* only) and refresh the page.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorText, postLead } from "@/lib/crm/api-client";
import type { CrmLabels } from "@/config/verticals/_types";
import { LEAD_CAPTION_CLASS, LEAD_FIELD_CLASS } from "@/components/dashboard/lead-field-class";

type Props = {
  waId: string;
  stages: ReadonlyArray<{ key: string; label: string }>;
  currentStage: string;
  lostKey: string;
  labels: CrmLabels;
};

export function LeadStageControl({ waId, stages, currentStage, lostKey, labels }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pendingLost, setPendingLost] = useState(false);
  const [reason, setReason] = useState(labels.lostReasons[0] ?? "");

  async function save(stage: string, lostReason?: string) {
    setBusy(true);
    const res = await postLead("set-stage", { contactWaId: waId, stage, lostReason });
    setBusy(false);
    if (res.ok) {
      setPendingLost(false);
      toast.success(labels.saved);
      router.refresh();
    } else {
      toast.error(errorText(labels.errors, res.error));
    }
  }

  function onChange(stage: string) {
    if (stage === currentStage) return;
    if (stage === lostKey) {
      setPendingLost(true);
      return;
    }
    void save(stage);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label htmlFor={`stage-${waId}`} className="sr-only">
          {labels.stageLabel}
        </label>
        <select
          id={`stage-${waId}`}
          data-testid="lead-stage-select"
          value={pendingLost ? lostKey : currentStage}
          disabled={busy}
          onChange={(e) => onChange(e.target.value)}
          className={LEAD_FIELD_CLASS}
        >
          {stages.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        {busy ? <Loader2 className="size-4 animate-spin text-[var(--soft-ink)]" aria-hidden /> : null}
      </div>

      {pendingLost ? (
        <div className="space-y-2 rounded-md border border-[var(--rule)] bg-[var(--canvas-2)] p-2.5">
          <label
            htmlFor={`lost-reason-${waId}`}
            className={LEAD_CAPTION_CLASS}
          >
            {labels.lostReasonLabel}
          </label>
          <select
            id={`lost-reason-${waId}`}
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
            className={LEAD_FIELD_CLASS}
          >
            {labels.lostReasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={busy}
              onClick={() => setPendingLost(false)}
            >
              {labels.cancel}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="destructive"
              disabled={busy}
              onClick={() => void save(lostKey, reason)}
            >
              {labels.save}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

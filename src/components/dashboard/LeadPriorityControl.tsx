"use client";

// Priority picker on the lead card (mirrors LeadStageControl): a native select
// with "Sin prioridad" + the three levels. Writes go through
// /api/leads/set-priority and refresh the page.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { errorText, postLead } from "@/lib/crm/api-client";
import { priorityOptions } from "@/lib/crm/priority";
import type { CrmLabels, CrmPriorityKey } from "@/config/verticals/_types";
import { LEAD_FIELD_CLASS } from "@/components/dashboard/lead-field-class";

type Props = {
  waId: string;
  current: CrmPriorityKey | "";
  labels: CrmLabels;
};

export function LeadPriorityControl({ waId, current, labels }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function save(priority: string) {
    if (priority === current) return;
    setBusy(true);
    const res = await postLead("set-priority", { contactWaId: waId, priority });
    setBusy(false);
    if (res.ok) {
      toast.success(labels.saved);
      router.refresh();
    } else {
      toast.error(errorText(labels.errors, res.error));
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={`priority-${waId}`} className="sr-only">
        {labels.priority.label}
      </label>
      <select
        id={`priority-${waId}`}
        data-testid="lead-priority-select"
        value={current}
        disabled={busy}
        onChange={(e) => void save(e.target.value)}
        className={LEAD_FIELD_CLASS}
      >
        <option value="">{labels.priority.none}</option>
        {priorityOptions(labels).map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      {busy ? <Loader2 className="size-4 animate-spin text-[var(--soft-ink)]" aria-hidden /> : null}
    </div>
  );
}

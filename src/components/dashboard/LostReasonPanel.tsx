"use client";

// Asks for the motive before a lead is marked lost from the board (drag or
// the ⋯ menu). Rendered at the top of the Perdido column, right above the
// card that just landed there; Cancelar / Esc sends the card back.

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEAD_FIELD_CLASS } from "@/components/dashboard/lead-field-class";
import { fillTemplate } from "@/lib/crm/view-model";
import type { CrmLabels } from "@/config/verticals/_types";

type Props = {
  leadName: string;
  labels: CrmLabels;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

export function LostReasonPanel({ leadName, labels, busy, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState(labels.lostReasons[0] ?? "");
  const selectRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  return (
    <div
      data-testid="lost-reason-panel"
      role="group"
      aria-label={fillTemplate(labels.markLostTitleTemplate, { name: leadName })}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
      className="space-y-2 rounded-lg border border-[color-mix(in_oklch,var(--danger)_35%,var(--rule))] bg-[var(--surface)] p-2.5 shadow-sm"
    >
      <p className="text-[12.5px] font-medium text-[var(--ink)]">
        {fillTemplate(labels.markLostTitleTemplate, { name: leadName })}
      </p>
      <label htmlFor="lost-reason-board" className="sr-only">
        {labels.lostReasonLabel}
      </label>
      <select
        ref={selectRef}
        id="lost-reason-board"
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
      <div className="flex justify-end gap-1.5">
        <Button type="button" size="xs" variant="ghost" disabled={busy} onClick={onCancel}>
          {labels.cancel}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="destructive"
          disabled={busy}
          data-testid="lost-reason-confirm"
          onClick={() => onConfirm(reason)}
        >
          {busy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
          {labels.markLost}
        </Button>
      </div>
    </div>
  );
}

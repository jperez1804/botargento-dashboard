"use client";

// Owner picker on the lead card. "Tomar" claims an unassigned lead (two-click
// confirm; the API answers 409 if someone else got there first). The select
// reassigns: an asesor can move unassigned leads and their own, an admin any.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Hand, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorText, postLead } from "@/lib/crm/api-client";
import { LEAD_FIELD_CLASS } from "@/components/dashboard/lead-field-class";
import type { CrmLabels } from "@/config/verticals/_types";

type Props = {
  waId: string;
  ownerEmail: string | null;
  members: ReadonlyArray<{ email: string; label: string }>;
  sessionEmail: string;
  isAdmin: boolean;
  labels: CrmLabels;
};

export function LeadOwnerControl({ waId, ownerEmail, members, sessionEmail, isAdmin, labels }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  const canReassign = isAdmin || ownerEmail === null || ownerEmail === sessionEmail;

  async function assign(body: Record<string, unknown>) {
    setBusy(true);
    setConfirming(false);
    const res = await postLead("assign", { contactWaId: waId, ...body });
    setBusy(false);
    if (res.ok) {
      toast.success(labels.saved);
      router.refresh();
    } else {
      toast.error(errorText(labels.errors, res.error));
      if (res.error === "already_owned") router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2">
      {canReassign ? (
        <>
          <label htmlFor={`owner-${waId}`} className="sr-only">
            {labels.ownerLabel}
          </label>
          <select
            id={`owner-${waId}`}
            data-testid="lead-owner-select"
            value={ownerEmail ?? ""}
            disabled={busy}
            onChange={(e) => void assign({ ownerEmail: e.target.value || null })}
            className={LEAD_FIELD_CLASS}
          >
            <option value="">{labels.unassigned}</option>
            {members.map((m) => (
              <option key={m.email} value={m.email}>
                {m.label}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {busy ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-[var(--soft-ink)]" aria-hidden />
      ) : ownerEmail === null ? (
        confirming ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            autoFocus
            onBlur={() => setConfirming(false)}
            onClick={() => void assign({ ownerEmail: "me", take: true })}
          >
            {labels.takeLeadConfirm}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="lead-take"
            onClick={() => setConfirming(true)}
            className="shrink-0"
          >
            <Hand className="size-3.5" aria-hidden />
            {labels.takeLead}
          </Button>
        )
      ) : null}
    </div>
  );
}

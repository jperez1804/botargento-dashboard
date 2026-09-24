"use client";

// "Nueva oportunidad": the same person asks about something else, or comes
// back months later. The bot opens its own when it hands somebody over
// (docs/crm-oportunidades.md, rule 5); this is the door for everything else —
// a phone call, a walk-in, a second search the advisor decides to track apart.
//
// The rubro is what separates one from another, so it is required; the title
// is free text for the advisor ("2 amb Palermo").

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LEAD_CAPTION_CLASS, LEAD_FIELD_CLASS } from "@/components/dashboard/lead-field-class";
import { errorText, postLead } from "@/lib/crm/api-client";
import { cn } from "@/lib/utils";
import type { CrmLabels } from "@/config/verticals/_types";

type Props = {
  contactWaId: string;
  labels: CrmLabels;
  intents: ReadonlyArray<{ key: string; label: string }>;
};

export function NewOpportunityDialog({ contactWaId, labels, intents }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(intents[0]?.key ?? "");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setKind(intents[0]?.key ?? "");
    setTitle("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !kind) return;
    setBusy(true);
    const res = await postLead("open", { contactWaId, kind, title: title.trim() });
    setBusy(false);
    if (!res.ok) {
      toast.error(errorText(labels.errors, res.error));
      return;
    }
    toast.success(labels.opportunity.createdToast);
    setOpen(false);
    reset();
    if (res.opportunityId) {
      router.push(`/conversations/${encodeURIComponent(contactWaId)}?op=${res.opportunityId}`);
    }
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button size="xs" variant="outline" data-testid="new-opportunity" />}>
        <Plus className="size-3" aria-hidden />
        {labels.opportunity.newButton}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.opportunity.dialogTitle}</DialogTitle>
          <DialogDescription>{labels.opportunity.dialogHint}</DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void submit(e)} className="space-y-3" data-testid="new-opportunity-form">
          <div className="space-y-1.5">
            <label htmlFor="new-opportunity-kind" className={LEAD_CAPTION_CLASS}>
              {labels.opportunity.kindLabel}
            </label>
            <select
              id="new-opportunity-kind"
              value={kind}
              disabled={busy}
              onChange={(e) => setKind(e.target.value)}
              className={cn(LEAD_FIELD_CLASS, "cursor-pointer")}
            >
              {intents.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-opportunity-title" className={LEAD_CAPTION_CLASS}>
              {labels.opportunity.titleLabel}
            </label>
            <input
              id="new-opportunity-title"
              value={title}
              maxLength={80}
              disabled={busy}
              autoFocus
              placeholder={labels.opportunity.titlePlaceholder}
              onChange={(e) => setTitle(e.target.value)}
              className={LEAD_FIELD_CLASS}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
              {labels.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={busy || !kind}>
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              {labels.opportunity.create}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

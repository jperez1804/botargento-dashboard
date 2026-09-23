"use client";

// "Nuevo lead": register someone who did not come through WhatsApp (phone
// call, walk-in, portal, referral). The phone is the lead's identity — the form
// previews the WhatsApp id it will be saved as, and if that person is already
// a lead the dialog offers to open it instead of creating a duplicate. Both
// land on the lead modal over the board (/leads/[waId]), the new one with the
// "Próximo paso" editor already open.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
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
import { formatLeadPhone, normalizeLeadPhone } from "@/lib/crm/phone";
import { errorText } from "@/lib/crm/api-client";
import { fillTemplate } from "@/lib/crm/view-model";
import { cn } from "@/lib/utils";
import type { CrmLabels, CrmLeadSourceDef } from "@/config/verticals/_types";

type Props = { labels: CrmLabels; sources: ReadonlyArray<CrmLeadSourceDef> };

export function NewLeadDialog({ labels, sources }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState(sources[0]?.key ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<string | null>(null);

  const normalized = phone.trim() ? normalizeLeadPhone(phone) : null;
  const canSubmit = !busy && name.trim() !== "" && normalized?.ok === true && source !== "";

  function reset() {
    setName("");
    setPhone("");
    setSource(sources[0]?.key ?? "");
    setNote("");
    setExisting(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setExisting(null);
    let data: { ok?: boolean; error?: string; contactWaId?: string } = {};
    try {
      const res = await fetch("/api/leads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, source, note }),
      });
      data = await res.json().catch(() => ({}));
    } catch {
      data = { error: "network" };
    }
    setBusy(false);

    if (data.ok && data.contactWaId) {
      toast.success(labels.leadCreated);
      setOpen(false);
      reset();
      router.push(`/leads/${encodeURIComponent(data.contactWaId)}?edit=reminder`);
      return;
    }
    if (data.error === "already_exists" && data.contactWaId) {
      setExisting(data.contactWaId);
      return;
    }
    toast.error(errorText(labels.errors, data.error));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm" data-testid="new-lead" />}>
        <UserPlus className="size-3.5" aria-hidden />
        {labels.newLead}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.newLeadTitle}</DialogTitle>
          <DialogDescription>{labels.newLeadHint}</DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void submit(e)} className="space-y-3" data-testid="new-lead-form">
          <div className="space-y-1.5">
            <label htmlFor="new-lead-name" className={LEAD_CAPTION_CLASS}>
              {labels.nameLabel}
            </label>
            <input
              id="new-lead-name"
              value={name}
              maxLength={80}
              required
              autoFocus
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              className={LEAD_FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-lead-phone" className={LEAD_CAPTION_CLASS}>
              {labels.phoneLabel}
            </label>
            <input
              id="new-lead-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              maxLength={40}
              required
              disabled={busy}
              placeholder={labels.phonePlaceholder}
              aria-invalid={normalized?.ok === false || undefined}
              aria-describedby="new-lead-phone-hint"
              onChange={(e) => {
                setPhone(e.target.value);
                setExisting(null);
              }}
              className={cn(LEAD_FIELD_CLASS, "tabular-nums")}
            />
            <p
              id="new-lead-phone-hint"
              data-testid="new-lead-phone-preview"
              className={cn(
                "min-h-[1.25em] text-[12px] tabular-nums",
                normalized?.ok === false ? "text-[var(--danger)]" : "text-[var(--soft-ink)]",
              )}
            >
              {normalized?.ok
                ? fillTemplate(labels.phonePreviewTemplate, { phone: formatLeadPhone(normalized.waId) })
                : normalized
                  ? labels.errors.invalid_phone
                  : ""}
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-lead-source" className={LEAD_CAPTION_CLASS}>
              {labels.sourceLabel}
            </label>
            <select
              id="new-lead-source"
              value={source}
              disabled={busy}
              onChange={(e) => setSource(e.target.value)}
              className={cn(LEAD_FIELD_CLASS, "cursor-pointer")}
            >
              {sources.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-lead-note" className={LEAD_CAPTION_CLASS}>
              {labels.noteLabel}
            </label>
            <textarea
              id="new-lead-note"
              value={note}
              rows={2}
              maxLength={2000}
              disabled={busy}
              onChange={(e) => setNote(e.target.value)}
              className={`${LEAD_FIELD_CLASS} h-auto min-h-[56px] py-1.5 resize-y`}
            />
          </div>

          {existing ? (
            <p role="alert" className="text-[12.5px] text-[var(--danger)]">
              {labels.errors.already_exists}{" "}
              <Link
                href={`/leads/${encodeURIComponent(existing)}`}
                className="font-medium underline underline-offset-2"
                onClick={() => setOpen(false)}
              >
                {labels.openExisting}
              </Link>
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
              {labels.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              {labels.createLead}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

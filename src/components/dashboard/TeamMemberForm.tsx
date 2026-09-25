"use client";

// One person in Configuración › Equipo — or, with `member` omitted, the "add a
// person" form. Role, display name and WhatsApp save together; "Quitar
// acceso" uses the repo's two-click inline confirmation.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LEAD_CAPTION_CLASS, LEAD_FIELD_CLASS } from "@/components/dashboard/lead-field-class";
import { TEAM_LABELS as L } from "@/config/team-labels";
import { formatLeadPhone, normalizeLeadPhone } from "@/lib/crm/phone";

type Role = "admin" | "asesor" | "viewer";

type Member = {
  email: string;
  role: Role;
  displayName: string;
  whatsappNumber: string;
  notifyWhatsapp: boolean;
};

type Props = { member?: Member; isSelf?: boolean };

async function post(path: "save" | "remove", body: Record<string, unknown>) {
  try {
    const res = await fetch(`/api/settings/team/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: res.ok && data.ok === true, error: data.error };
  } catch {
    return { ok: false, error: "network" };
  }
}

const EMPTY: Member = { email: "", role: "asesor", displayName: "", whatsappNumber: "", notifyWhatsapp: true };

export function TeamMemberForm({ member, isSelf = false }: Props) {
  const router = useRouter();
  const isNew = !member;
  const [draft, setDraft] = useState<Member>(member ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  const dirty = isNew || JSON.stringify(draft) !== JSON.stringify(member);
  const idBase = `team-${(member?.email ?? "new").replace(/[^a-z0-9]/gi, "-")}`;
  const set = <K extends keyof Member>(k: K, v: Member[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // What the server will store. null while the field is empty.
  const waPreview = draft.whatsappNumber.trim() ? normalizeLeadPhone(draft.whatsappNumber) : null;

  async function save() {
    setBusy(true);
    const res = await post("save", { ...draft, whatsappNumber: draft.whatsappNumber.trim() });
    setBusy(false);
    if (res.ok) {
      toast.success(isNew ? L.added : L.saved);
      if (isNew) setDraft(EMPTY);
      router.refresh();
    } else {
      toast.error(L.errors[res.error ?? "network"] ?? L.errors.network);
    }
  }

  async function remove() {
    setConfirming(false);
    setBusy(true);
    const res = await post("remove", { email: draft.email });
    setBusy(false);
    if (res.ok) {
      toast.success(L.removed);
      router.refresh();
    } else {
      toast.error(L.errors[res.error ?? "network"] ?? L.errors.network);
    }
  }

  return (
    <div
      data-team-member={member?.email ?? "new"}
      className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
    >
      <div className="space-y-1.5 min-w-0">
        {isNew ? (
          <>
            <label htmlFor={`${idBase}-email`} className={LEAD_CAPTION_CLASS}>{L.emailLabel}</label>
            <input
              id={`${idBase}-email`}
              type="email"
              value={draft.email}
              disabled={busy}
              onChange={(e) => set("email", e.target.value)}
              className={LEAD_FIELD_CLASS}
            />
          </>
        ) : (
          <p className="text-[13.5px] font-medium text-[var(--ink)] truncate">
            {draft.email}
            {isSelf ? <span className="ml-1.5 text-[12px] font-normal text-[var(--soft-ink)]">({L.you})</span> : null}
          </p>
        )}
        <label htmlFor={`${idBase}-name`} className="sr-only">{L.nameLabel}</label>
        <input
          id={`${idBase}-name`}
          value={draft.displayName}
          placeholder={L.namePlaceholder}
          maxLength={80}
          disabled={busy}
          onChange={(e) => set("displayName", e.target.value)}
          className={LEAD_FIELD_CLASS}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${idBase}-role`} className={LEAD_CAPTION_CLASS}>{L.columnRole}</label>
        <select
          id={`${idBase}-role`}
          value={draft.role}
          disabled={busy || isSelf}
          onChange={(e) => set("role", e.target.value as Role)}
          className={LEAD_FIELD_CLASS}
        >
          {(["admin", "asesor", "viewer"] as const).map((r) => (
            <option key={r} value={r}>{L.roles[r]}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${idBase}-wa`} className={LEAD_CAPTION_CLASS}>{L.columnWhatsapp}</label>
        <input
          id={`${idBase}-wa`}
          inputMode="numeric"
          value={draft.whatsappNumber}
          placeholder={L.whatsappPlaceholder}
          maxLength={20}
          disabled={busy}
          onChange={(e) => set("whatsappNumber", e.target.value)}
          className={cn(LEAD_FIELD_CLASS, "tabular-nums")}
          aria-describedby={`${idBase}-wa-hint`}
        />
        <p
          id={`${idBase}-wa-hint`}
          data-testid="team-wa-preview"
          className={cn(
            "min-h-[1.25em] text-[12px] tabular-nums",
            waPreview?.ok === false ? "text-[var(--danger)]" : "text-[var(--soft-ink)]",
          )}
        >
          {waPreview?.ok
            ? L.whatsappPreviewTemplate.replace("{phone}", formatLeadPhone(waPreview.waId))
            : waPreview
              ? L.whatsappInvalid
              : ""}
        </p>
        <label className="flex items-center gap-1.5 text-[12px] text-[var(--muted-ink)]">
          <input
            type="checkbox"
            checked={draft.notifyWhatsapp}
            disabled={busy}
            onChange={(e) => set("notifyWhatsapp", e.target.checked)}
          />
          {L.notifyLabel}
        </label>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        {busy ? <Loader2 className="size-4 animate-spin text-[var(--soft-ink)]" aria-hidden /> : null}
        {!isNew && !isSelf ? (
          confirming ? (
            <Button type="button" size="xs" variant="destructive" autoFocus onBlur={() => setConfirming(false)} onClick={() => void remove()}>
              {L.removeConfirm}
            </Button>
          ) : (
            <Button type="button" size="xs" variant="ghost" disabled={busy} aria-label={L.remove} title={L.remove} onClick={() => setConfirming(true)}>
              <UserMinus className="size-3.5" aria-hidden />
            </Button>
          )
        ) : null}
        <Button type="button" size="sm" disabled={busy || !dirty || (isNew && !draft.email.trim())} onClick={() => void save()}>
          {isNew ? L.add : L.save}
        </Button>
      </div>
    </div>
  );
}

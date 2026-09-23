"use client";

// Log what happened outside the bot: a note, a call, a visit or a meeting.
// The kind comes first (chips above the text) so the feed and the Resumen
// stay truthful; the placeholder and the button follow the chosen kind.
// Logging a visit or meeting on a lead that is still before that stage makes
// the toast offer the move. Each entry restarts the lead's inactivity clock.

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Phone, StickyNote, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { errorText, postLead } from "@/lib/crm/api-client";
import { fillTemplate } from "@/lib/crm/view-model";
import type { StageOffer } from "@/lib/crm/activity-stage";
import { LEAD_FIELD_CLASS, TOGGLE_CHIP_CLASS } from "@/components/dashboard/lead-field-class";
import type { CrmActivityKind, CrmLabels } from "@/config/verticals/_types";

const KINDS: ReadonlyArray<{ key: CrmActivityKind; Icon: typeof StickyNote }> = [
  { key: "note", Icon: StickyNote },
  { key: "call", Icon: Phone },
  { key: "visit", Icon: MapPin },
  { key: "meeting", Icon: Users },
];

const noSubscribe = () => () => {};
const readIsMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

type Props = {
  waId: string;
  labels: CrmLabels;
  // Per kind, the stage the activity implies when it is ahead of the lead.
  offers: Partial<Record<CrmActivityKind, StageOffer>>;
};

export function LeadActivityComposer({ waId, labels, offers }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<CrmActivityKind>("note");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  // The server does not know the visitor's keyboard: hydrate with the
  // generic hint, then read the platform on the client.
  const isMac = useSyncExternalStore(noSubscribe, readIsMac, () => false);
  const keys = isMac ? "⌘↵" : "Ctrl+↵";

  async function moveTo(offer: StageOffer) {
    const res = await postLead("set-stage", { contactWaId: waId, stage: offer.key });
    if (res.ok) toast.success(labels.saved);
    else toast.error(errorText(labels.errors, res.error));
    router.refresh();
  }

  async function submit() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    const res = await postLead("event", { contactWaId: waId, kind, body: text });
    setBusy(false);
    if (!res.ok) {
      toast.error(errorText(labels.errors, res.error));
      return;
    }
    setBody("");
    router.refresh();
    const offer = offers[kind];
    if (offer) {
      toast.success(labels.saved, {
        action: {
          label: fillTemplate(labels.moveToStageOfferTemplate, { stage: offer.label }),
          onClick: () => void moveTo(offer),
        },
      });
    } else {
      toast.success(labels.saved);
    }
  }

  const kindLabel = labels.eventKinds[kind];

  return (
    <div className="space-y-2" data-testid="lead-activity-composer">
      <div role="group" aria-label={labels.activityKindLabel} className="flex flex-wrap gap-1">
        {KINDS.map(({ key, Icon }) => (
          <button
            key={key}
            type="button"
            data-testid={`activity-kind-${key}`}
            aria-pressed={kind === key}
            disabled={busy}
            onClick={() => setKind(key)}
            className={cn(TOGGLE_CHIP_CLASS, "gap-1")}
          >
            <Icon className="size-3" aria-hidden />
            {labels.eventKinds[key]}
          </button>
        ))}
      </div>
      <textarea
        aria-label={kindLabel}
        data-testid="lead-activity-body"
        value={body}
        rows={2}
        maxLength={2000}
        disabled={busy}
        placeholder={labels.activityPlaceholders[kind]}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
        }}
        className={`${LEAD_FIELD_CLASS} h-auto min-h-[56px] py-1.5 resize-y`}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] text-[var(--muted-ink)]">
          {fillTemplate(labels.shortcutHintTemplate, { keys })}
        </span>
        <Button
          type="button"
          size="sm"
          data-testid="lead-activity-submit"
          disabled={busy || !body.trim()}
          onClick={() => void submit()}
          className="shrink-0"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          {fillTemplate(labels.addActivityTemplate, { kind: kindLabel.toLowerCase() })}
        </Button>
      </div>
    </div>
  );
}

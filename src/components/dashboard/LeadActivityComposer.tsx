"use client";

// Log what happened outside the bot: a note, a call, a visit or a meeting.
// Each entry restarts the lead's inactivity clock.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorText, postLead } from "@/lib/crm/api-client";
import { LEAD_FIELD_CLASS } from "@/components/dashboard/lead-field-class";
import type { CrmActivityKind, CrmLabels } from "@/config/verticals/_types";

const KINDS: ReadonlyArray<CrmActivityKind> = ["note", "call", "visit", "meeting"];

type Props = { waId: string; labels: CrmLabels };

export function LeadActivityComposer({ waId, labels }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<CrmActivityKind>("note");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    const res = await postLead("event", { contactWaId: waId, kind, body: text });
    setBusy(false);
    if (res.ok) {
      setBody("");
      toast.success(labels.saved);
      router.refresh();
    } else {
      toast.error(errorText(labels.errors, res.error));
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        aria-label={labels.activityTitle}
        data-testid="lead-activity-body"
        value={body}
        rows={2}
        maxLength={2000}
        disabled={busy}
        placeholder={labels.activityPlaceholder}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
        }}
        className={`${LEAD_FIELD_CLASS} h-auto min-h-[56px] py-1.5 resize-y`}
      />
      <div className="flex items-center gap-2">
        <select
          aria-label={labels.activityTitle}
          value={kind}
          disabled={busy}
          onChange={(e) => setKind(e.target.value as CrmActivityKind)}
          className={LEAD_FIELD_CLASS}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {labels.eventKinds[k]}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          data-testid="lead-activity-submit"
          disabled={busy || !body.trim()}
          onClick={() => void submit()}
          className="shrink-0"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          {labels.addActivity}
        </Button>
      </div>
    </div>
  );
}

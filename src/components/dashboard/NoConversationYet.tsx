// Stand-in for the chat on a lead registered by hand who has not written on
// WhatsApp yet: says so, shows where the lead came from and who loaded it,
// and offers to open a WhatsApp chat with the number.

import { MessageCircle, UserPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fillTemplate, formatDay } from "@/lib/crm/view-model";
import type { CrmConfig } from "@/config/verticals/_types";
import type { ContactInfo } from "@/lib/queries/leads";

type Props = {
  waId: string;
  manual: ContactInfo;
  config: CrmConfig;
  memberLabel: (email: string | null) => string;
  locale: string;
  timezone: string;
};

export function NoConversationYet({ waId, manual, config, memberLabel, locale, timezone }: Props) {
  const labels = config.labels;
  const source = config.manualLeadSources.find((s) => s.key === manual.source)?.label ?? manual.source;
  return (
    <div
      data-testid="no-conversation"
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--rule-strong)] bg-[var(--surface)] px-6 py-10 text-center"
    >
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--canvas-2)] text-[var(--soft-ink)]">
        <UserPlus className="size-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-[15px] font-semibold text-[var(--ink)]">{labels.noConversationTitle}</p>
        <p className="mx-auto max-w-[420px] text-[13px] text-[var(--muted-ink)]">{labels.noConversationBody}</p>
      </div>
      <p className="text-[12.5px] text-[var(--soft-ink)]">
        {fillTemplate(labels.manualOriginTemplate, { source })}{" "}
        {fillTemplate(labels.manualByTemplate, {
          who: memberLabel(manual.createdBy || null),
          date: formatDay(manual.createdAt, locale, timezone),
        })}
      </p>
      <a
        href={`https://wa.me/${encodeURIComponent(waId)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <MessageCircle className="size-4" aria-hidden />
        {labels.openWhatsapp}
      </a>
    </div>
  );
}

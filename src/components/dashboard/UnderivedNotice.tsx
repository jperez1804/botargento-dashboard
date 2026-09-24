// Somebody wrote to the bot about something recognisable but never reached a
// handoff, so no opportunity opened (docs/crm-oportunidades.md, rule 8). They
// are not lost: this says what they asked about and offers to open one.

import { MessageCircleQuestion } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OpenOpportunityButton } from "@/components/dashboard/OpenOpportunityButton";
import { fillTemplate } from "@/lib/crm/view-model";
import { leadIntent } from "@/lib/crm/intent";
import type { CrmConfig, IntentDef } from "@/config/verticals/_types";

type Props = {
  waId: string;
  // Vertical intent key of what they asked about; null = nothing recognisable.
  kind: string | null;
  config: CrmConfig;
  intents: ReadonlyArray<IntentDef>;
  canEdit: boolean;
};

export function UnderivedNotice({ waId, kind, config, intents, canEdit }: Props) {
  const labels = config.labels;
  const label = leadIntent(kind, intents)?.label;

  return (
    <Card data-testid="underived-notice">
      <CardContent className="space-y-2 px-4 py-4">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--ink)]">
          <MessageCircleQuestion className="size-4 shrink-0 text-[var(--soft-ink)]" aria-hidden />
          {labels.opportunity.underivedTitle}
          {label ? (
            <span className="inline-flex h-[20px] items-center rounded-full bg-[var(--info-soft)] px-1.5 text-[11.5px] font-medium text-[color-mix(in_oklch,var(--info)_75%,var(--ink))]">
              {label}
            </span>
          ) : null}
        </p>
        <p className="text-[12.5px] leading-snug text-[var(--muted-ink)]">
          {labels.opportunity.underivedHint}
        </p>
        {canEdit ? (
          <div className="flex justify-end pt-0.5">
            <OpenOpportunityButton
              contactWaId={waId}
              kind={kind ?? ""}
              labels={labels}
              size="xs"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** The same thing as one row of a table: used by the Conversaciones filter. */
export function underivedKindLabel(
  kind: string | null,
  intents: ReadonlyArray<IntentDef>,
  fallback: string,
): string {
  return leadIntent(kind, intents)?.label ?? fallback;
}

export function underivedCount(labels: CrmConfig["labels"], n: number): string {
  return n === 1
    ? labels.opportunity.underivedCountOne
    : fillTemplate(labels.opportunity.underivedCountTemplate, { n });
}

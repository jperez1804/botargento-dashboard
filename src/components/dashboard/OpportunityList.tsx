// Every opportunity of one person, on their page. A lead card shows ONE
// commercial process; this is where you see that the same person also rented
// last year and is asking about an appraisal now.
//
// Each row carries its own ordinal ("5ª"), the same number the board card
// shows, so a card and its row always find each other no matter how the list
// is sorted. Open ones come first; closed ones stay, dimmed, because the
// history is the point.

import Link from "next/link";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LEAD_CAPTION_CLASS } from "@/components/dashboard/lead-field-class";
import { LeadStageChip } from "@/components/dashboard/LeadStageChip";
import { NewOpportunityDialog } from "@/components/dashboard/NewOpportunityDialog";
import { fillTemplate, formatDay } from "@/lib/crm/view-model";
import { leadIntent } from "@/lib/crm/intent";
import { cn } from "@/lib/utils";
import type { CrmConfig, IntentDef } from "@/config/verticals/_types";
import type { OpportunityRow } from "@/lib/queries/leads";

type Props = {
  waId: string;
  canEdit: boolean;
  intentOptions: ReadonlyArray<{ key: string; label: string }>;
  opportunities: ReadonlyArray<OpportunityRow>;
  selectedId: number | null;
  config: CrmConfig;
  intents: ReadonlyArray<IntentDef>;
  locale: string;
  timezone: string;
};

export function OpportunityList({
  waId,
  canEdit,
  intentOptions,
  opportunities,
  selectedId,
  config,
  intents,
  locale,
  timezone,
}: Props) {
  if (opportunities.length === 0) return null;
  const labels = config.labels;
  const stageOf = (key: string) => config.stages.find((s) => s.key === key);

  return (
    <Card data-testid="opportunity-list">
      <CardContent className="space-y-2 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className={LEAD_CAPTION_CLASS}>
            {labels.opportunity.listTitle} · {opportunities.length}
          </p>
          {canEdit ? (
            <NewOpportunityDialog contactWaId={waId} labels={labels} intents={intentOptions} />
          ) : null}
        </div>
        <ol className="space-y-1">
          {opportunities.map((o) => {
            const selected = o.id === selectedId;
            const stage = stageOf(o.lead.stage);
            const kind = leadIntent(o.kind, intents)?.label;
            const when = o.closedAt
              ? fillTemplate(labels.opportunity.closedTemplate, {
                  date: formatDay(o.closedAt, locale, timezone),
                })
              : fillTemplate(labels.opportunity.openedTemplate, {
                  date: formatDay(o.openedAt, locale, timezone),
                });
            return (
              <li key={o.id}>
                <Link
                  href={`/conversations/${encodeURIComponent(waId)}?op=${o.id}`}
                  data-testid="opportunity-row"
                  data-opportunity={o.id}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2 py-1.5 text-[12.5px]",
                    "transition-colors duration-150",
                    selected
                      ? "border-[color-mix(in_oklch,var(--client-primary)_55%,var(--rule))] bg-[color-mix(in_oklch,var(--client-primary)_8%,var(--surface))]"
                      : "border-transparent hover:bg-[var(--canvas-2)]",
                    o.closedAt && !selected && "opacity-70",
                  )}
                >
                  {/* The ordinal is the opportunity's name: the board card
                      shows the same one. */}
                  <span className="w-[26px] shrink-0 font-medium tabular-nums text-[var(--muted-ink)]">
                    {fillTemplate(labels.opportunity.ordinalTemplate, { n: o.seq })}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-[var(--ink)]">
                    {kind || labels.opportunity.kindNone}
                    {o.title ? ` · ${o.title}` : ""}
                  </span>
                  {stage ? (
                    <LeadStageChip
                      label={stage.label}
                      tone={stage.tone}
                      auto={o.lead.source === "auto"}
                      autoTitle={labels.autoStageDetail}
                    />
                  ) : null}
                  <span className="shrink-0 tabular-nums text-[var(--muted-ink)]">{when}</span>
                  {selected ? (
                    <Check className="size-3.5 shrink-0 text-[var(--client-primary)]" aria-hidden />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

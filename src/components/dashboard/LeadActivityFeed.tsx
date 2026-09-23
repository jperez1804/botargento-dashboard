// Activity history card: composer (asesor/admin) + the lead's lead_events,
// newest first. System events (stage changes, assignments, reminders, inbox
// contacts) render with their structured detail from metadata.

import { Card, CardContent } from "@/components/ui/card";
import { LeadActivityComposer } from "@/components/dashboard/LeadActivityComposer";
import { LEAD_CAPTION_CLASS } from "@/components/dashboard/lead-field-class";
import { formatDayTime } from "@/lib/crm/view-model";
import { describeLeadEvent, eventKindLabel } from "@/lib/crm/event-text";
import { stageOffers } from "@/lib/crm/activity-stage";
import type { CrmConfig } from "@/config/verticals/_types";
import type { LeadEvent } from "@/lib/queries/lead-detail";

type Props = {
  waId: string;
  events: ReadonlyArray<LeadEvent>;
  config: CrmConfig;
  memberLabel: (email: string | null) => string;
  canEdit: boolean;
  locale: string;
  timezone: string;
  // The lead's current stage: decides whether logging a visit offers the move.
  stageKey: string;
};

export function LeadActivityFeed({ waId, events, config, memberLabel, canEdit, locale, timezone, stageKey }: Props) {
  const labels = config.labels;
  const kindLabel = (kind: string) => eventKindLabel(config, kind);
  return (
    <Card data-testid="lead-activity">
      <CardContent className="px-5 py-4 space-y-3">
        <p className={LEAD_CAPTION_CLASS}>{labels.activityTitle}</p>
        {canEdit ? (
          <LeadActivityComposer waId={waId} labels={labels} offers={stageOffers(config, stageKey)} />
        ) : null}
        {events.length === 0 ? (
          <p className="text-[12.5px] text-[var(--soft-ink)] italic">{labels.emptyActivity}</p>
        ) : (
          <ol className="max-h-[360px] overflow-y-auto space-y-2.5 pr-1">
            {events.map((e) => {
              const text = describeLeadEvent(e, config, memberLabel);
              return (
                <li key={e.id} className="space-y-0.5 border-l-2 border-[var(--rule)] pl-2.5">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[11.5px] text-[var(--soft-ink)]">
                    <span className="font-medium text-[var(--muted-ink)]">{kindLabel(e.kind)}</span>
                    <span className="tabular-nums">{formatDayTime(e.occurredAt, locale, timezone)}</span>
                    {e.createdBy ? <span className="truncate">{memberLabel(e.createdBy)}</span> : null}
                  </p>
                  {text ? (
                    <p className="text-[13px] text-[var(--ink)] whitespace-pre-line break-words">{text}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

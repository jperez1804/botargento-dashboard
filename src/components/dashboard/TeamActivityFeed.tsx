// /leads › Actividad: everything the team did across every lead, newest first.
// Each row: kind icon, what happened (same wording as the lead's own history,
// via describeLeadEvent), the lead it belongs to, who and when.

import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  ArrowRightLeft,
  BellRing,
  CheckCheck,
  Flag,
  House,
  MessageSquareReply,
  Phone,
  StickyNote,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { describeLeadEvent, eventKindLabel } from "@/lib/crm/event-text";
import { formatDayTime } from "@/lib/crm/view-model";
import type { CrmConfig } from "@/config/verticals/_types";
import type { TeamLeadEvent } from "@/lib/queries/lead-detail";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const KIND_ICON: Record<string, Icon> = {
  note: StickyNote,
  priority: Flag,
  call: Phone,
  visit: House,
  meeting: Users,
  stage_change: ArrowRightLeft,
  assignment: UserCheck,
  reminder_set: BellRing,
  reminder_done: CheckCheck,
  contact: MessageSquareReply,
  created: UserPlus,
};

type Props = {
  events: ReadonlyArray<TeamLeadEvent>;
  config: CrmConfig;
  memberLabel: (email: string | null) => string;
  locale: string;
  timezone: string;
};

export function TeamActivityFeed({ events, config, memberLabel, locale, timezone }: Props) {
  if (events.length === 0) {
    return <EmptyState icon={<StickyNote className="size-5" aria-hidden />} title={config.labels.emptyActivity} />;
  }
  return (
    <ol
      data-testid="team-activity"
      className="divide-y divide-[var(--rule)] rounded-xl border border-[var(--rule)] bg-[var(--surface)]"
    >
      {events.map((e) => {
        const Icon = KIND_ICON[e.kind] ?? StickyNote;
        const text = describeLeadEvent(e, config, memberLabel);
        return (
          <li key={e.id} data-event-kind={e.kind} className="flex gap-3 px-5 py-3">
            <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--canvas-2)] text-[var(--muted-ink)]">
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                <span className="font-medium text-[var(--ink)]">{eventKindLabel(config, e.kind)}</span>
                <Link
                  href={`/conversations/${encodeURIComponent(e.contactWaId)}${e.opportunityId ? `?op=${e.opportunityId}` : ""}`}
                  className="truncate text-[var(--info)] underline-offset-2 hover:underline"
                >
                  {e.leadName}
                </Link>
              </p>
              {text ? (
                <p className="whitespace-pre-line break-words text-[13px] text-[var(--muted-ink)]">{text}</p>
              ) : null}
              <p className="text-[11.5px] tabular-nums text-[var(--soft-ink)]">
                {formatDayTime(e.occurredAt, locale, timezone)}
                {e.createdBy ? ` · ${memberLabel(e.createdBy)}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

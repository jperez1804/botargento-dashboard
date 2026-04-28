// Server component — pure data → markup. Groups lead_log entries by day in
// the tenant tz, then renders inbound/outbound bubbles with intent tags.

import { cn } from "@/lib/utils";
import { formatAutomationLabel } from "@/lib/automation-labels";
import type { LeadLogEntry } from "@/lib/queries/contacts";
import type { IntentDef } from "@/config/verticals/_types";

type Props = {
  entries: ReadonlyArray<LeadLogEntry>;
  intents: ReadonlyArray<IntentDef>;
  locale: string;
  timezone: string;
};

type DayBucket = { dayKey: string; dayLabel: string; entries: LeadLogEntry[] };

function bucketByDay(
  entries: ReadonlyArray<LeadLogEntry>,
  locale: string,
  timezone: string,
): DayBucket[] {
  const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  });
  const dayLabelFmt = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  });
  const buckets = new Map<string, DayBucket>();
  for (const e of entries) {
    const d = new Date(e.createdAt);
    const dayKey = dayKeyFmt.format(d); // YYYY-MM-DD in tenant tz
    let bucket = buckets.get(dayKey);
    if (!bucket) {
      bucket = {
        dayKey,
        dayLabel: dayLabelFmt.format(d),
        entries: [],
      };
      buckets.set(dayKey, bucket);
    }
    bucket.entries.push(e);
  }
  return [...buckets.values()];
}

function intentColor(value: string | null, intents: ReadonlyArray<IntentDef>): string {
  if (!value) return "#94a3b8";
  const hit = intents.find((i) => i.key.toLowerCase() === value.toLowerCase());
  return hit?.color ?? "#94a3b8";
}

function intentLabel(value: string | null, intents: ReadonlyArray<IntentDef>): string | null {
  if (!value) return null;
  const hit = intents.find((i) => i.key.toLowerCase() === value.toLowerCase());
  return hit?.label ?? formatAutomationLabel(value) ?? value;
}

export function ConversationTimeline({ entries, intents, locale, timezone }: Props) {
  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-[#e5e7eb] bg-white p-6 text-sm text-[#6b7280]">
        No hay mensajes registrados para este contacto.
      </div>
    );
  }

  const buckets = bucketByDay(entries, locale, timezone);
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });

  return (
    <div className="space-y-6">
      {buckets.map((bucket) => (
        <section key={bucket.dayKey} className="space-y-3">
          <div className="sticky top-0 z-10 -mx-1 px-1 py-1 bg-[#fafafa]/85 backdrop-blur">
            <div className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
              {bucket.dayLabel}
            </div>
          </div>

          <ol className="space-y-2">
            {bucket.entries.map((e) => {
              const isInbound = e.direction === "inbound";
              const intent = intentLabel(e.intent, intents);
              const color = intentColor(e.intent, intents);
              return (
                <li
                  key={e.id}
                  className={cn("flex w-full", isInbound ? "justify-start" : "justify-end")}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                      isInbound
                        ? "bg-white border border-[#e5e7eb]"
                        : "bg-[var(--client-primary)]/5 border border-[var(--client-primary)]/20",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1 text-[11px]">
                      <span
                        className={cn(
                          "font-medium",
                          isInbound ? "text-[#111827]" : "text-[var(--client-primary)]",
                        )}
                      >
                        {isInbound ? "Cliente" : "Bot"}
                      </span>
                      <span className="text-[#9ca3af] tabular-nums">
                        {timeFmt.format(new Date(e.createdAt))}
                      </span>
                      {intent && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px]"
                          style={{ background: `${color}1F`, color }}
                        >
                          <span
                            className="size-1 rounded-full"
                            style={{ background: color }}
                            aria-hidden="true"
                          />
                          {intent}
                        </span>
                      )}
                      {e.route && (
                        <span className="text-[10px] text-[#9ca3af]">· {e.route}</span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#111827]">
                      {e.messageText ?? <span className="text-[#9ca3af]">(sin texto)</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

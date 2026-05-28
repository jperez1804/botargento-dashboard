// Server component — pure data -> markup. Groups lead_log entries by day in
// the tenant tz, then renders inbound/outbound bubbles. The dashboard owns
// the bot voice: customer (inbound) aligns left on surface, bot (outbound)
// aligns right on canvas-2. No brand tint on bot bubbles — brand color is
// reserved for the six designated surfaces (nav rail, charts, etc.).

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
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  });
  const buckets = new Map<string, DayBucket>();
  for (const e of entries) {
    const d = new Date(e.createdAt);
    const dayKey = dayKeyFmt.format(d);
    let bucket = buckets.get(dayKey);
    if (!bucket) {
      bucket = { dayKey, dayLabel: dayLabelFmt.format(d), entries: [] };
      buckets.set(dayKey, bucket);
    }
    bucket.entries.push(e);
  }
  return [...buckets.values()];
}

function intentLabel(
  value: string | null,
  intents: ReadonlyArray<IntentDef>,
): string | null {
  if (!value) return null;
  const hit = intents.find((i) => i.key.toLowerCase() === value.toLowerCase());
  return hit?.label ?? formatAutomationLabel(value) ?? value;
}

export function ConversationTimeline({ entries, intents, locale, timezone }: Props) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--rule-strong)] bg-[var(--surface)] py-10 px-6 flex flex-col items-center text-center gap-2.5">
        <div className="text-sm font-semibold text-[var(--ink)]">
          Sin mensajes en esta conversación
        </div>
        <div className="text-[12.5px] text-[var(--soft-ink)] max-w-[320px] leading-snug">
          Aparecerán acá cuando el contacto escriba al bot.
        </div>
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
    <div className="space-y-2">
      {buckets.map((bucket) => (
        <section key={bucket.dayKey}>
          <DayDivider label={bucket.dayLabel} />
          <ol className="space-y-1.5">
            {bucket.entries.map((e) => {
              const isInbound = e.direction === "inbound";
              const intent = intentLabel(e.intent, intents);
              const flowTag = !isInbound && e.route
                ? `${intent ? intent.toLowerCase() + " · " : ""}${e.route}`
                : null;
              return (
                <li
                  key={e.id}
                  className={cn(
                    "flex w-full",
                    isInbound ? "justify-start" : "justify-end",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[78%] min-w-[60px] px-3 py-2 border text-[13.5px] leading-snug text-[var(--ink)]",
                      // Customer (left): surface bg, top-left corner squared
                      // to read as a "tail" pointing at the customer.
                      // Bot (right): canvas-2 bg, top-right corner squared.
                      // The fill diff is subtle but reads instantly at full
                      // conversation density.
                      isInbound
                        ? "bg-[var(--surface)] border-[var(--rule)] rounded-xl rounded-tl-sm"
                        : "bg-[var(--canvas-2)] border-[var(--rule)] rounded-xl rounded-tr-sm",
                    )}
                  >
                    {flowTag ? (
                      <div className="text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--soft-ink)] font-[var(--font-geist-mono)] mb-1">
                        {flowTag}
                      </div>
                    ) : null}
                    <div className="whitespace-pre-wrap">
                      {e.messageText ?? (
                        <span className="text-[var(--soft-ink)] italic">(sin texto)</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--soft-ink)] tabular-nums mt-1 text-right">
                      {timeFmt.format(new Date(e.createdAt))}
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

// Centered day separator. Hairlines on either side + a neutral pill
// holding the locale-formatted day. Not sticky — the thread reads as a
// continuous timeline, not a series of sticky sections.
function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <div className="flex-1 h-px bg-[var(--rule)]" />
      <span className="inline-flex items-center h-[20px] px-2.5 rounded-full bg-[var(--neutral-soft)] text-[var(--muted-ink)] text-[11px] font-medium tracking-[-0.005em]">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--rule)]" />
    </div>
  );
}

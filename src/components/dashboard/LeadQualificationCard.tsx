// "Lo que captó el bot": the qualification data from the lead's latest real
// handoff and its session snapshot, labelled by the vertical config. Hidden
// when the bot captured nothing.

import { Card, CardContent } from "@/components/ui/card";
import { LEAD_CAPTION_CLASS } from "@/components/dashboard/lead-field-class";
import type { QualificationItem } from "@/lib/queries/lead-detail";
import { formatMoney } from "@/lib/crm/view-model";

type Props = { title: string; items: ReadonlyArray<QualificationItem>; locale: string };

function moneyText(value: string, currency: string, locale: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? formatMoney(n, currency, locale) : value;
}

function Links({ value }: { value: string }) {
  const urls = value
    .split(/[\s,]+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));
  if (urls.length === 0) return <>{value}</>;
  return (
    <span className="flex flex-col items-end gap-0.5">
      {urls.map((u, i) => (
        <a
          key={`${i}-${u}`}
          href={u}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--info)] underline-offset-2 hover:underline"
        >
          #{i + 1}
        </a>
      ))}
    </span>
  );
}

export function LeadQualificationCard({ title, items, locale }: Props) {
  if (items.length === 0) return null;
  return (
    <Card data-testid="lead-qualification">
      <CardContent className="px-5 py-4 space-y-3">
        <p className={LEAD_CAPTION_CLASS}>{title}</p>
        <dl className="space-y-2">
          {items.map((item) => (
            <div key={item.label} className="flex justify-between gap-3 text-[13px]">
              <dt className="text-[var(--soft-ink)] shrink-0">{item.label}</dt>
              <dd className="text-[var(--ink)] text-right min-w-0 break-words">
                {item.format === "money" ? (
                  <span className="tabular-nums">{moneyText(item.value, item.currency, locale)}</span>
                ) : item.format === "links" ? (
                  <Links value={item.value} />
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

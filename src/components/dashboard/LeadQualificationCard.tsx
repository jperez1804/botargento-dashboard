// "Lo que captó el bot": the qualification data from the lead's latest real
// handoff and its session snapshot, labelled by the vertical config. The
// story first: the bot's summary as a paragraph, then the key facts as one
// chip line, and the rest folded under "Ver todo (N)". Hidden when the bot
// captured nothing.

import { Card, CardContent } from "@/components/ui/card";
import { LEAD_CAPTION_CLASS } from "@/components/dashboard/lead-field-class";
import type { QualificationItem } from "@/lib/queries/lead-detail";
import { fillTemplate, formatMoney } from "@/lib/crm/view-model";
import { extractUrls, listingLinkLabel } from "@/lib/crm/links";
import type { CrmLabels } from "@/config/verticals/_types";

type Props = {
  title: string;
  items: ReadonlyArray<QualificationItem>;
  locale: string;
  labels: Pick<CrmLabels, "showAllTemplate" | "showLess">;
};

function moneyText(value: string, currency: string, locale: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? formatMoney(n, currency, locale) : value;
}

function Links({ value }: { value: string }) {
  const urls = extractUrls(value);
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
          {listingLinkLabel(u)}
        </a>
      ))}
    </span>
  );
}

function Value({ item, locale }: { item: QualificationItem; locale: string }) {
  if (item.format === "money") {
    return <span className="tabular-nums">{moneyText(item.value, item.currency, locale)}</span>;
  }
  if (item.format === "links") return <Links value={item.value} />;
  return <>{item.value}</>;
}

function Details({ items, locale }: { items: ReadonlyArray<QualificationItem>; locale: string }) {
  return (
    <dl className="space-y-2">
      {items.map((item) => (
        <div key={item.key} className="flex justify-between gap-3 text-[13px]">
          <dt className="shrink-0 text-[var(--muted-ink)]">{item.label}</dt>
          <dd className="min-w-0 break-words text-right text-[var(--ink)]">
            <Value item={item} locale={locale} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function LeadQualificationCard({ title, items, locale, labels }: Props) {
  if (items.length === 0) return null;
  const summary = items.filter((i) => i.display === "summary");
  const chips = items.filter((i) => i.display === "chip");
  const rest = items.filter((i) => i.display === "detail");
  const headlined = summary.length > 0 || chips.length > 0;

  return (
    <Card data-testid="lead-qualification">
      <CardContent className="space-y-3 px-5 py-4">
        <p className={LEAD_CAPTION_CLASS}>{title}</p>
        {summary.map((item) => (
          <p
            key={item.key}
            data-testid="lead-qualification-summary"
            className="text-[13px] leading-relaxed text-[var(--ink)] whitespace-pre-line break-words"
          >
            {item.value}
          </p>
        ))}
        {chips.length > 0 ? (
          <ul data-testid="lead-qualification-chips" className="flex flex-wrap gap-1.5">
            {chips.map((item) => (
              <li
                key={item.key}
                className="inline-flex h-[22px] max-w-full items-center gap-1 rounded-full border border-[var(--rule)] bg-[var(--canvas-2)] px-2 text-[11.5px]"
              >
                <span className="text-[var(--muted-ink)]">{item.label}</span>
                <span className="truncate font-medium text-[var(--ink)]">
                  <Value item={item} locale={locale} />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {rest.length === 0 ? null : headlined ? (
          <details className="group">
            <summary
              data-testid="lead-qualification-more"
              className="cursor-pointer list-none text-[12.5px] font-medium text-[var(--muted-ink)] hover:text-[var(--ink)] [&::-webkit-details-marker]:hidden"
            >
              <span className="group-open:hidden">{fillTemplate(labels.showAllTemplate, { n: rest.length })}</span>
              <span className="hidden group-open:inline">{labels.showLess}</span>
            </summary>
            <div className="pt-2">
              <Details items={rest} locale={locale} />
            </div>
          </details>
        ) : (
          <Details items={rest} locale={locale} />
        )}
      </CardContent>
    </Card>
  );
}

// Attention strip under the header: leads about to go "perdido" for
// inactivity and overdue reminders. Rendered on every page load/refresh (the
// layout is dynamic), hidden when there is nothing to act on. Links only — no
// client JS.

import Link from "next/link";
import { AlarmClock, Hourglass } from "lucide-react";
import { fillTemplate } from "@/lib/crm/view-model";
import type { CrmLabels } from "@/config/verticals/_types";
import type { CrmAlerts } from "@/lib/queries/leads";

type Props = { alerts: CrmAlerts; labels: CrmLabels; scopeMine: boolean };

const LINK =
  "inline-flex items-center gap-1.5 font-medium underline-offset-[3px] hover:underline rounded focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-2";

export function CrmAlertBanner({ alerts, labels, scopeMine }: Props) {
  if (alerts.atRisk === 0 && alerts.overdueReminders === 0) return null;
  const mine = scopeMine ? "&mine=1" : "";
  return (
    <div
      role="status"
      data-testid="crm-alert-banner"
      className="border-b border-[color-mix(in_oklch,var(--warning)_35%,var(--rule))] bg-[var(--warning-soft)] text-[color-mix(in_oklch,var(--warning)_55%,var(--ink))]"
    >
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-1.5 px-4 py-2 text-[13px] md:px-6">
        {alerts.atRisk > 0 ? (
          <Link href={`/leads?filter=at_risk${mine}`} className={LINK}>
            <Hourglass className="size-3.5 shrink-0" aria-hidden />
            {alerts.atRisk === 1
              ? labels.bannerAtRiskOne
              : fillTemplate(labels.bannerAtRiskTemplate, { n: alerts.atRisk })}
          </Link>
        ) : null}
        {alerts.overdueReminders > 0 ? (
          <Link href={`/leads?filter=overdue${mine}`} className={LINK}>
            <AlarmClock className="size-3.5 shrink-0" aria-hidden />
            {alerts.overdueReminders === 1
              ? labels.bannerOverdueOne
              : fillTemplate(labels.bannerOverdueTemplate, { n: alerts.overdueReminders })}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

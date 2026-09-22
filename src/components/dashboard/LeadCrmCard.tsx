// The CRM card on /conversations/[waId]: stage, owner and next step. Server
// Component — it only lays out the derived LeadView; the interactive pieces
// are small client controls. Viewers get the same card without controls.

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LeadStageChip } from "@/components/dashboard/LeadStageChip";
import { LeadStageControl } from "@/components/dashboard/LeadStageControl";
import { LeadOwnerControl } from "@/components/dashboard/LeadOwnerControl";
import { LeadReminderControl } from "@/components/dashboard/LeadReminderControl";
import { LeadPriorityChip } from "@/components/dashboard/LeadPriorityChip";
import { LeadPriorityControl } from "@/components/dashboard/LeadPriorityControl";
import { LeadBudgetControl } from "@/components/dashboard/LeadBudgetControl";
import { crmCurrencies } from "@/lib/crm/budget";
import { LEAD_CAPTION_CLASS } from "@/components/dashboard/lead-field-class";
import type { CrmConfig } from "@/config/verticals/_types";
import type { LeadView } from "@/lib/crm/view-model";

type Props = {
  waId: string;
  view: LeadView;
  config: CrmConfig;
  members: ReadonlyArray<{ email: string; label: string }>;
  sessionEmail: string;
  isAdmin: boolean;
  canEdit: boolean;
};

export function LeadCrmCard({ waId, view, config, members, sessionEmail, isAdmin, canEdit }: Props) {
  const labels = config.labels;
  const manualBudget =
    view.budget?.source === "manual" && view.budget.amount !== null
      ? { amount: view.budget.amount, currency: view.budget.currency }
      : null;
  // An open reminder is the first thing an asesor needs to see: it moves up
  // right under the stage. Otherwise "Próximo paso" keeps its place at the end.
  const reminderOpen = view.reminder !== null && view.reminder.status !== "done";
  const reminderSection = (
    <section className="space-y-2 border-t border-[var(--rule)] pt-3">
      <span className="text-[12.5px] text-[var(--soft-ink)]">{labels.nextStepLabel}</span>
      <LeadReminderControl waId={waId} reminder={view.reminder} canEdit={canEdit} labels={labels} />
    </section>
  );
  return (
    <Card data-testid="lead-crm-card">
      <CardContent className="px-5 py-4 space-y-4">
        <p className={LEAD_CAPTION_CLASS}>{labels.cardTitle}</p>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] text-[var(--soft-ink)]">{labels.stageLabel}</span>
            <LeadStageChip
              label={view.stageLabel}
              tone={view.tone}
              auto={view.auto}
              autoTitle={labels.autoStageHint}
            />
          </div>
          {view.statusText ? (
            <p
              data-testid="lead-status"
              className={cn(
                "text-[12.5px] font-medium",
                view.statusTone === "danger" ? "text-[var(--danger)]" : "text-[color-mix(in_oklch,var(--warning)_70%,var(--ink))]",
              )}
            >
              {view.statusText}
            </p>
          ) : null}
          {view.auto ? (
            <p className="text-[11.5px] leading-snug text-[var(--soft-ink)]">{labels.autoStageHint}</p>
          ) : null}
          {canEdit ? (
            <LeadStageControl
              waId={waId}
              stages={config.stages.map((s) => ({ key: s.key, label: s.label }))}
              currentStage={view.stageKey}
              lostKey={config.autoStages.lost}
              labels={labels}
            />
          ) : null}
        </section>

        {reminderOpen ? reminderSection : null}

        <section className="space-y-2 border-t border-[var(--rule)] pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] text-[var(--soft-ink)]">{labels.priority.label}</span>
            {view.priority ? (
              <LeadPriorityChip label={view.priority.label} tone={view.priority.tone} />
            ) : (
              <span className="text-[12.5px] italic text-[var(--soft-ink)]">{labels.priority.none}</span>
            )}
          </div>
          {canEdit ? (
            <LeadPriorityControl waId={waId} current={view.priority?.key ?? ""} labels={labels} />
          ) : null}
        </section>

        <section className="space-y-2 border-t border-[var(--rule)] pt-3" data-testid="lead-budget-section">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] text-[var(--soft-ink)]">{labels.budget.label}</span>
            {view.budgetText ? (
              <span data-testid="lead-budget-value" className="text-[13px] font-medium tabular-nums text-[var(--ink)]">
                {view.budgetText}
              </span>
            ) : (
              <span className="text-[12.5px] italic text-[var(--soft-ink)]">{labels.budget.none}</span>
            )}
          </div>
          {view.budget && view.budget.source === "bot" ? (
            <p className="text-[11.5px] leading-snug text-[var(--soft-ink)]">{labels.budget.fromBot}</p>
          ) : null}
          {canEdit ? (
            <LeadBudgetControl
              key={manualBudget ? `${manualBudget.amount}-${manualBudget.currency}` : "none"}
              waId={waId}
              manual={manualBudget}
              currencies={crmCurrencies(config)}
              labels={labels}
            />
          ) : null}
        </section>

        <section className="space-y-2 border-t border-[var(--rule)] pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] text-[var(--soft-ink)]">{labels.ownerLabel}</span>
            <span data-testid="lead-owner" className="text-[13px] font-medium text-[var(--ink)] truncate">
              {view.ownerLabel}
            </span>
          </div>
          {canEdit ? (
            <LeadOwnerControl
              waId={waId}
              ownerEmail={view.ownerEmail}
              members={members}
              sessionEmail={sessionEmail}
              isAdmin={isAdmin}
              labels={labels}
            />
          ) : null}
        </section>

        {reminderOpen ? null : reminderSection}
      </CardContent>
    </Card>
  );
}

// The Guía tab of /leads: what each stage means, who moves a lead there, and
// the rules that run on their own. Everything comes from the vertical config
// (stage `help`, labels.guide, autoLostDays/warnDays) — no prose in JSX.

import { cn } from "@/lib/utils";
import { LeadStageChip } from "@/components/dashboard/LeadStageChip";
import { LeadPriorityChip } from "@/components/dashboard/LeadPriorityChip";
import { buildGuideRules, buildStageGuide, type StageMover } from "@/lib/crm/guide";
import { priorityOptions } from "@/lib/crm/priority";
import { fillTemplate } from "@/lib/crm/view-model";
import type { CrmConfig } from "@/config/verticals/_types";

type Props = { config: CrmConfig };

const MOVER_CLASS: Record<StageMover, string> = {
  bot: "bg-[var(--info-soft)] text-[var(--info)]",
  person: "bg-[var(--warning-soft)] text-[color-mix(in_oklch,var(--warning)_65%,var(--ink))]",
  both: "bg-[var(--neutral-soft)] text-[var(--muted-ink)]",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--ink)]">{title}</h2>
      {children}
    </section>
  );
}

export function LeadsGuide({ config }: Props) {
  const g = config.labels.guide;
  const qualifiedLabel =
    config.stages.find((s) => s.key === config.autoStages.qualified)?.label ??
    config.autoStages.qualified;
  const stages = buildStageGuide(config);
  const rules = buildGuideRules(config);

  return (
    <article
      data-testid="leads-guide"
      className="w-full max-w-[760px] space-y-8 text-[14px] leading-relaxed text-[var(--ink)]"
    >
      <header className="space-y-2">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{g.title}</h1>
        <p className="text-[var(--muted-ink)]">{g.intro}</p>
      </header>

      <Section title={g.opportunitiesTitle}>
        <p>{g.opportunitiesIntro}</p>
        <ul className="list-disc space-y-1 pl-5 text-[var(--muted-ink)]">
          <li>{g.opportunitiesHandoff}</li>
          <li>{g.opportunitiesSameKind}</li>
          <li>{g.opportunitiesMessages}</li>
          <li>{g.opportunitiesManual}</li>
          <li>{g.opportunitiesKind}</li>
          <li>{g.opportunitiesOrdinal}</li>
          <li>{g.opportunitiesUnderived}</li>
        </ul>
      </Section>

      <Section title={g.stagesTitle}>
        <ol className="divide-y divide-[var(--rule)] rounded-xl border border-[var(--rule)] bg-[var(--surface)]">
          {stages.map((s) => (
            <li key={s.key} data-guide-stage={s.key} className="space-y-1.5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <LeadStageChip label={s.label} tone={s.tone} />
                <span
                  className={cn(
                    "inline-flex h-[20px] items-center rounded-full px-2 text-[10.5px] font-medium uppercase tracking-[0.06em]",
                    MOVER_CLASS[s.mover],
                  )}
                >
                  {s.moverLabel}
                </span>
              </div>
              {s.help ? <p>{s.help}</p> : null}
              {s.trigger ? <p className="text-[13px] text-[var(--muted-ink)]">{s.trigger}</p> : null}
            </li>
          ))}
        </ol>
      </Section>

      <Section title={g.rulesTitle}>
        <p>{rules.inactivity}</p>
        <p className="text-[var(--muted-ink)]">{rules.reversible}</p>
      </Section>

      <Section title={g.activityTitle}>
        <p>{g.activityIntro}</p>
        <ul className="list-disc space-y-1 pl-5 text-[var(--muted-ink)]">
          <li>{g.activityMessages}</li>
          {rules.activityKinds.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
        <p data-testid="guide-activity-no-stage">
          {fillTemplate(g.activityNoStage, { qualified: qualifiedLabel })}
        </p>
      </Section>

      <Section title={g.remindersTitle}>
        <p>{g.remindersBody}</p>
      </Section>

      <Section title={g.priorityTitle}>
        <p>{g.priorityBody}</p>
        <ul className="space-y-2">
          {priorityOptions(config.labels).map((p) => (
            <li key={p.key} className="flex items-start gap-2.5">
              <LeadPriorityChip label={p.label} tone={p.tone} className="mt-0.5" />
              <span className="text-[var(--muted-ink)]">{g.priorityMeaning[p.key]}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={g.sourcesTitle}>
        <p>{g.sourcesBody}</p>
        <p className="text-[13px] text-[var(--muted-ink)]">
          {[config.labels.sourceWhatsapp, ...config.manualLeadSources.map((s) => s.label)].join(" · ")}
        </p>
      </Section>
    </article>
  );
}

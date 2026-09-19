import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/role-guard";
import { listTeam } from "@/lib/queries/team";
import { TeamMemberForm } from "@/components/dashboard/TeamMemberForm";
import { TEAM_LABELS as L } from "@/config/team-labels";

export default async function TeamSettingsPage() {
  const session = await requireRole("admin");
  const team = await listTeam();

  return (
    <div className="space-y-6 max-w-4xl">
      <nav aria-label="Migas de pan" className="text-[13px]">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-[var(--muted-ink)] hover:text-[var(--ink)] hover:underline underline-offset-[3px]"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          {L.backToSettings}
        </Link>
      </nav>

      <header className="space-y-3 border-b border-[var(--rule)] pb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)] font-[var(--font-geist-mono)]">
          {L.kicker}
        </p>
        <h1 className="text-[30px] leading-[1.1] tracking-[-0.025em] text-[var(--ink)] font-semibold">
          {L.title}
        </h1>
        <p className="text-[13px] text-[var(--muted-ink)] max-w-[640px] leading-snug">{L.intro}</p>
      </header>

      <section
        aria-label={L.title}
        className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)]"
      >
        {team.map((m) => (
          <TeamMemberForm
            key={m.email}
            isSelf={m.email === session.email}
            member={{
              email: m.email,
              role: m.role,
              displayName: m.displayName,
              whatsappNumber: m.whatsappNumber,
              notifyWhatsapp: m.notifyWhatsapp,
            }}
          />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-[17px] leading-tight tracking-[-0.015em] text-[var(--ink)] font-semibold">
          {L.addTitle}
        </h2>
        <div className="rounded-xl border border-dashed border-[var(--rule-strong)] bg-[var(--surface)]">
          <TeamMemberForm />
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import { ChevronLeft, History } from "lucide-react";
import { listAuditEntries, type AuditEntry } from "@/lib/queries/audit";
import { tenantConfig } from "@/config/tenant";
import { requireRole } from "@/lib/role-guard";
import { formatDateTime } from "@/lib/date";
import { EmptyState } from "@/components/ui/empty-state";

const ACTION_LABEL: Record<string, string> = {
  theme_update: "Color de marca",
};

type ThemeMetadata = { from?: string; to?: string };

function isThemeMetadata(m: unknown): m is ThemeMetadata {
  return typeof m === "object" && m !== null && ("from" in m || "to" in m);
}

export default async function AuditLogPage() {
  await requireRole("admin");
  const [entries, tenant] = await Promise.all([listAuditEntries(100), tenantConfig()]);

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="space-y-3 border-b border-[var(--rule)] pb-5">
        <div className="flex items-center gap-2 text-[13px]">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-[var(--muted-ink)] hover:text-[var(--ink)] hover:underline underline-offset-[3px]"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Configuración
          </Link>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[30px] leading-[1.1] tracking-[-0.025em] text-[var(--ink)] font-semibold">
            Bitácora de auditoría
          </h1>
          <p className="text-[13px] text-[var(--muted-ink)]">
            Últimos {entries.length} eventos administrativos.
          </p>
        </div>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          icon={<History className="size-[18px]" />}
          title="Sin eventos registrados"
          body="Los cambios administrativos —color de marca, roles— aparecerán acá una vez ocurran."
        />
      ) : (
        <ul className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)] overflow-hidden">
          {entries.map((entry) => (
            <li key={entry.id} className="px-5 py-4">
              <AuditRow entry={entry} locale={tenant.locale} timezone={tenant.timezone} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AuditRow({
  entry,
  locale,
  timezone,
}: {
  entry: AuditEntry;
  locale: string;
  timezone: string;
}) {
  const actionLabel = ACTION_LABEL[entry.action] ?? entry.action;
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-start">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-[var(--neutral-soft)] text-[var(--muted-ink)] text-[11px] font-medium">
            {actionLabel}
          </span>
          <span className="text-[12.5px] text-[var(--muted-ink)] truncate">
            {entry.email ?? "sistema"}
          </span>
        </div>
        <AuditMetadata action={entry.action} metadata={entry.metadata} />
      </div>
      <div className="text-[12.5px] text-[var(--soft-ink)] tabular-nums whitespace-nowrap sm:text-right">
        {formatDateTime(entry.createdAt, locale, timezone)}
      </div>
    </div>
  );
}

function AuditMetadata({ action, metadata }: { action: string; metadata: unknown }) {
  if (action === "theme_update" && isThemeMetadata(metadata)) {
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--ink)]">
        {metadata.from ? <ColorChip hex={metadata.from} /> : <span>—</span>}
        <span className="text-[var(--soft-ink)]">→</span>
        {metadata.to ? <ColorChip hex={metadata.to} /> : <span>—</span>}
      </div>
    );
  }
  // Unknown action — render JSON inline for engineers.
  return (
    <pre className="text-[11.5px] font-[var(--font-geist-mono)] text-[var(--soft-ink)] whitespace-pre-wrap break-words leading-snug">
      {JSON.stringify(metadata, null, 0)}
    </pre>
  );
}

function ColorChip({ hex }: { hex: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rule-strong)] bg-[var(--surface)] pl-1 pr-2 py-0.5 text-[12px] font-[var(--font-geist-mono)] tabular-nums">
      <span
        className="size-3 rounded-sm border border-[color-mix(in_oklch,currentColor_14%,transparent)]"
        style={{ backgroundColor: hex }}
        aria-hidden="true"
      />
      {hex}
    </span>
  );
}

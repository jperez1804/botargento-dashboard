import Link from "next/link";
import { ChevronRight, History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ColorPicker } from "@/components/dashboard/ColorPicker";
import { getAppSettings } from "@/lib/queries/app-settings";
import { requireRole } from "@/lib/role-guard";

export default async function SettingsPage() {
  await requireRole("admin");
  const settings = await getAppSettings();

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="space-y-3 border-b border-[var(--rule)] pb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)] font-[var(--font-geist-mono)]">
          Administración
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[30px] leading-[1.1] tracking-[-0.025em] text-[var(--ink)] font-semibold">
            Configuración
          </h1>
          <p className="text-[13px] text-[var(--muted-ink)]">
            Los cambios se aplican a todo el tenant y quedan registrados en la bitácora de auditoría.
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)]">
            Marca
          </p>
          <h2 className="text-[17px] leading-tight tracking-[-0.015em] text-[var(--ink)] font-semibold">
            Color de marca
          </h2>
          <p className="text-[13px] text-[var(--muted-ink)] max-w-[640px] leading-snug">
            Acento principal del panel. Se aplica al rail de navegación activo,
            al mapa de demanda, a la primera serie de los gráficos y al botón
            principal. La vista previa se actualiza al instante; los cambios se
            guardan al confirmar.
          </p>
        </div>
        <Card>
          <CardContent className="px-5 py-5">
            <ColorPicker defaultValue={settings.primaryColor} />
          </CardContent>
        </Card>
      </section>

      {/* Audit log entry — every privileged action in /settings writes to
        * dashboard.audit_log. Surface the link prominently so admins can
        * trace who-changed-what without rooting around in the database. */}
      <section className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)]">
            Trazabilidad
          </p>
          <h2 className="text-[17px] leading-tight tracking-[-0.015em] text-[var(--ink)] font-semibold">
            Bitácora de auditoría
          </h2>
          <p className="text-[13px] text-[var(--muted-ink)] max-w-[640px] leading-snug">
            Historial de cambios administrativos: quién cambió qué y cuándo.
          </p>
        </div>
        <Link
          href="/settings/audit"
          className="group/audit flex items-center gap-3 rounded-xl border border-[var(--rule)] bg-[var(--surface)] px-5 py-4 hover:bg-[var(--canvas-2)] transition-colors focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-2"
        >
          <div className="size-9 rounded-lg bg-[var(--canvas-2)] text-[var(--soft-ink)] flex items-center justify-center">
            <History className="size-[18px]" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--ink)]">
              Ver bitácora completa
            </div>
            <div className="text-[12.5px] text-[var(--soft-ink)]">
              Últimos 100 eventos administrativos
            </div>
          </div>
          <ChevronRight
            className="size-[14px] text-[var(--soft-ink)] group-hover/audit:text-[var(--ink)] transition-colors"
            aria-hidden="true"
          />
        </Link>
      </section>
    </div>
  );
}

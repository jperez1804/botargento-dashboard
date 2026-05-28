import { Card, CardContent } from "@/components/ui/card";
import { ColorPicker } from "@/components/dashboard/ColorPicker";
import { getAppSettings } from "@/lib/queries/app-settings";
import { requireRole } from "@/lib/role-guard";

export default async function SettingsPage() {
  // requireRole redirects viewers to / and audits the denial. By the time we
  // reach getAppSettings the caller is guaranteed to be an admin.
  await requireRole("admin");
  const settings = await getAppSettings();

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page header — mirrors the Derivaciones + overview masthead pattern. */}
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
    </div>
  );
}

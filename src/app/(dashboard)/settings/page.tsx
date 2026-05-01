import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="space-y-1">
        <h1 className="text-[28px] font-semibold leading-tight">Configuración</h1>
        <p className="text-sm text-[var(--muted-ink)]">
          Ajustes operativos del panel. Los cambios se aplican a todos los usuarios del tenant y
          quedan registrados en la bitácora de auditoría.
        </p>
      </div>

      <Card className="ring-1 ring-black/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Color de marca</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--muted-ink)]">
            Acento principal del panel. Se aplica al gráfico de volumen, al mapa de demanda por
            hora, a las insignias y a los enlaces activos. La vista previa se actualiza al
            instante; los cambios se guardan al confirmar.
          </p>
          <ColorPicker defaultValue={settings.primaryColor} />
        </CardContent>
      </Card>
    </div>
  );
}

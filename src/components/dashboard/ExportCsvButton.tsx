"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  endpoint: "/api/export/conversations" | "/api/export/daily-metrics";
  params?: Record<string, string | undefined>;
  label?: string;
};

export function ExportCsvButton({ endpoint, params, label = "Exportar CSV" }: Props) {
  const [pending, startTransition] = useTransition();

  function buildHref(): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v) search.set(k, v);
    }
    const qs = search.toString();
    return `${endpoint}${qs ? `?${qs}` : ""}`;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const res = await fetch(buildHref(), { credentials: "include" });
            if (res.status === 429) {
              toast.error("Demasiadas exportaciones — esperá un minuto y volvé a intentar.");
              return;
            }
            if (!res.ok) {
              toast.error("No se pudo generar el CSV.");
              return;
            }
            const blob = await res.blob();
            const filename =
              res.headers
                .get("Content-Disposition")
                ?.match(/filename="?([^"]+)"?/)
                ?.[1] ?? "export.csv";
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success("Exportación lista");
          } catch {
            toast.error("Error inesperado al exportar.");
          }
        })
      }
    >
      <Download className="size-4" />
      {label}
    </Button>
  );
}

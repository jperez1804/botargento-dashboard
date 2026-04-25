"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to dev console; container logs catch it server-side.
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-md border border-[#e5e7eb] bg-white p-8 max-w-xl mx-auto text-center space-y-4">
      <div className="size-12 rounded-full bg-[#fef2f2] flex items-center justify-center mx-auto">
        <AlertTriangle className="size-6 text-[#dc2626]" />
      </div>
      <h2 className="text-base font-semibold text-[#111827]">
        No pudimos cargar esta sección
      </h2>
      <p className="text-sm text-[#6b7280]">
        Algo falló al consultar los datos. Probá actualizar — si persiste, avisanos.
      </p>
      {error.digest && (
        <p className="text-[11px] text-[#9ca3af] tabular-nums">ref: {error.digest}</p>
      )}
      <Button type="button" onClick={reset}>
        <RefreshCw className="size-4" />
        Reintentar
      </Button>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() =>
        startTransition(() => {
          router.refresh();
          toast.success("Datos actualizados");
        })
      }
      disabled={pending}
      aria-label="Actualizar datos"
    >
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
      <span className="sr-only sm:not-sr-only sm:ml-2">Actualizar</span>
    </Button>
  );
}

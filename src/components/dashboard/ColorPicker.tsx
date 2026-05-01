"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// Curated quick-pick chips. Sampled from common Argentine real-estate brand
// palettes — sage, terracotta, deep navy, brick red, graphite, default blue.
// Operators can ignore these and use the picker for arbitrary colors.
const SWATCHES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "#3b82f6", label: "Azul (predeterminado)" },
  { value: "#0f3a5f", label: "Azul marino" },
  { value: "#5d7a4a", label: "Salvia" },
  { value: "#b94a3a", label: "Terracota" },
  { value: "#7a1f1f", label: "Rojo profundo" },
  { value: "#374151", label: "Grafito" },
];

type Props = {
  defaultValue: string;
};

export function ColorPicker({ defaultValue }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(defaultValue);
  const [hexInput, setHexInput] = useState(defaultValue);
  const [isSaving, setIsSaving] = useState(false);
  const previousValueRef = useRef(defaultValue);

  // Live preview: update the document root --client-primary so every
  // component that reads `var(--client-primary)` recolors immediately,
  // BEFORE the operator clicks save. Cleanup restores the persisted value
  // when the component unmounts so other pages don't inherit the preview.
  useEffect(() => {
    if (!HEX_COLOR_RE.test(value)) return;
    document.documentElement.style.setProperty("--client-primary", value);
  }, [value]);

  useEffect(() => {
    const restore = previousValueRef.current;
    return () => {
      document.documentElement.style.setProperty("--client-primary", restore);
    };
  }, []);

  function commitHexInput(next: string) {
    const trimmed = next.trim().toLowerCase();
    setHexInput(trimmed);
    if (HEX_COLOR_RE.test(trimmed)) setValue(trimmed);
  }

  const isDirty = value.toLowerCase() !== defaultValue.toLowerCase();
  const isValid = HEX_COLOR_RE.test(value);

  async function handleSave() {
    if (!isValid || !isDirty) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryColor: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      previousValueRef.current = value;
      toast.success("Color actualizado", {
        description: "Los cambios se aplicaron a todo el panel.",
      });
      startTransition(() => router.refresh());
    } catch (err) {
      const message = err instanceof Error ? err.message : "error desconocido";
      toast.error("No se pudo guardar el color", { description: message });
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    setValue(previousValueRef.current);
    setHexInput(previousValueRef.current);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="primary-color-input"
            className="inline-flex items-center gap-2 cursor-pointer"
          >
            <span
              className="size-12 rounded-md border border-[var(--rule)] shadow-inner"
              style={{ backgroundColor: isValid ? value : "transparent" }}
              aria-hidden="true"
            />
            <input
              id="primary-color-input"
              type="color"
              value={isValid ? value : "#000000"}
              onChange={(e) => {
                setValue(e.target.value);
                setHexInput(e.target.value);
              }}
              className="sr-only"
            />
            <span className="text-sm text-[var(--muted-ink)]">
              Hacé clic para abrir el selector
            </span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--muted-ink)]">Hex:</span>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => commitHexInput(e.target.value)}
              spellCheck={false}
              maxLength={7}
              className={cn(
                "w-28 rounded-md border bg-transparent px-2 py-1 font-[var(--font-geist-mono)] text-sm uppercase tracking-wide outline-none",
                isValid
                  ? "border-[var(--rule)] focus:border-[var(--client-primary)]"
                  : "border-[var(--bad)] text-[var(--bad)]",
              )}
              aria-invalid={!isValid}
            />
          </div>
        </div>
        {!isValid ? (
          <p className="mt-2 text-xs text-[var(--bad)]">
            Formato inválido — usar #rrggbb (6 dígitos hexadecimales).
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-[var(--soft-ink)] mb-2">
          Sugerencias
        </p>
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map((swatch) => {
            const active = value.toLowerCase() === swatch.value.toLowerCase();
            return (
              <button
                key={swatch.value}
                type="button"
                onClick={() => {
                  setValue(swatch.value);
                  setHexInput(swatch.value);
                }}
                aria-label={swatch.label}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs transition-colors",
                  active
                    ? "border-[var(--client-primary)] bg-[var(--client-primary)]/10"
                    : "border-[var(--rule)] hover:bg-[var(--canvas)]",
                )}
              >
                <span
                  className="size-4 rounded-sm"
                  style={{ backgroundColor: swatch.value }}
                  aria-hidden="true"
                />
                <span className="text-[var(--ink)]">{swatch.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={handleSave}
          disabled={!isValid || !isDirty || isSaving || isPending}
          variant="default"
        >
          {isSaving || isPending ? "Guardando…" : "Guardar"}
        </Button>
        <Button
          type="button"
          onClick={handleReset}
          disabled={!isDirty || isSaving}
          variant="outline"
        >
          Descartar
        </Button>
        {isDirty && !isSaving ? (
          <span className="text-xs text-[var(--muted-ink)]">
            Vista previa activa — guardá para persistir.
          </span>
        ) : null}
      </div>
    </div>
  );
}

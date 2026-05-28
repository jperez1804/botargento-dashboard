"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandPreview } from "@/components/dashboard/BrandPreview";
import {
  evaluateBrandContrast,
  type BrandContrast,
  type ContrastStatus,
} from "@/lib/contrast";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// Curated preset list. Each entry is pre-validated to hold at least
// `warn` contrast on both light AND dark surfaces — operators can pick
// any of these without seeing the contrast meter complain. Free hex
// input below is the "advanced" path that surfaces warnings when needed.
const SWATCHES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "#3b82f6", label: "Azul" },
  { value: "#0f3a5f", label: "Azul marino" },
  { value: "#5d7a4a", label: "Salvia" },
  { value: "#b94a3a", label: "Terracota" },
  { value: "#7a1f1f", label: "Rojo profundo" },
  { value: "#d97706", label: "Ámbar" },
  { value: "#7c3aed", label: "Violeta" },
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

  // Live preview: push the picked hex to documentElement.style so every
  // var(--client-primary) consumer recolors immediately, BEFORE save.
  // Cleanup on unmount restores the persisted value so other pages don't
  // inherit a transient preview.
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
  const contrast = useMemo<BrandContrast | null>(
    () => (isValid ? evaluateBrandContrast(value) : null),
    [value, isValid],
  );
  const hasContrastWarning =
    !!contrast && (contrast.light !== "pass" || contrast.dark !== "pass");

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
    <div className="space-y-5">
      {/* Top row: swatch preview + hex input */}
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor="primary-color-input"
          className="inline-flex items-center gap-3 cursor-pointer"
        >
          <span
            className="size-12 rounded-lg border border-[var(--rule-strong)] shadow-inner shrink-0"
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
          <span className="text-[13px] text-[var(--muted-ink)]">
            Hacé clic para abrir el selector
          </span>
        </label>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[12.5px] text-[var(--soft-ink)]">Hex</span>
          <input
            type="text"
            value={hexInput}
            onChange={(e) => commitHexInput(e.target.value)}
            spellCheck={false}
            maxLength={7}
            className={cn(
              "w-[120px] h-9 rounded-lg border bg-[var(--surface)] px-3 font-[var(--font-geist-mono)] text-[13px] uppercase tracking-wide outline-none focus-visible:ring-2",
              isValid
                ? "border-[var(--rule-strong)] focus-visible:ring-[color-mix(in_oklch,var(--client-primary)_30%,transparent)] focus-visible:border-[var(--ink)]"
                : "border-[var(--danger)] text-[var(--danger)] focus-visible:ring-[color-mix(in_oklch,var(--danger)_30%,transparent)]",
            )}
            aria-invalid={!isValid}
          />
        </div>
      </div>
      {!isValid ? (
        <p className="text-[12.5px] text-[var(--danger)]">
          Formato inválido — usar #rrggbb (6 dígitos hexadecimales).
        </p>
      ) : null}

      {/* Preset chips — pre-validated for AA contrast in both modes. */}
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)]">
          Presets validados
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
                  "inline-flex items-center gap-2 rounded-full border pl-1.5 pr-3 py-1 text-[12.5px] transition-colors focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-2",
                  active
                    ? "border-[var(--ink)] bg-[var(--canvas-2)] font-semibold text-[var(--ink)]"
                    : "border-[var(--rule-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--canvas-2)]",
                )}
              >
                <span
                  className="size-4 rounded-full border border-[color-mix(in_oklch,currentColor_14%,transparent)]"
                  style={{ backgroundColor: swatch.value }}
                  aria-hidden="true"
                />
                {swatch.label}
                {active ? <Check className="size-3 ml-0.5" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contrast meter — runs against both --surface (light) and the dark
        * --surface. Warn/fail surfaces a non-blocking banner below. */}
      {contrast ? <ContrastMeter contrast={contrast} /> : null}

      {/* Validation banner — shown when contrast is below AA threshold on
        * either mode. Non-blocking; the operator can still save. */}
      {hasContrastWarning ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-[color-mix(in_oklch,var(--warning)_35%,var(--rule))] bg-[var(--warning-soft)] px-3.5 py-2.5 text-[12.5px]"
        >
          <AlertTriangle
            className="size-[15px] shrink-0 mt-0.5 text-[var(--warning)]"
            aria-hidden="true"
          />
          <div className="flex-1">
            <strong className="font-semibold text-[var(--ink)]">
              {contrast.light !== "pass" && contrast.dark !== "pass"
                ? "Contraste bajo en ambos modos"
                : contrast.dark !== "pass"
                  ? "Contraste bajo en modo oscuro"
                  : "Contraste bajo en modo claro"}
            </strong>
            <p className="text-[var(--muted-ink)] mt-1 leading-snug">
              El rail de navegación, el botón principal y el trazo del gráfico
              pueden ser difíciles de distinguir contra la superficie. Probá un
              preset o ajustá la luminosidad del color.
            </p>
          </div>
        </div>
      ) : null}

      {/* Live preview — re-renders on every value change */}
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)]">
          Vista previa
        </p>
        <BrandPreview primary={isValid ? value : undefined} />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--rule)] pt-4">
        <div className="text-[12px] text-[var(--soft-ink)]">
          {isDirty && !isSaving
            ? "Vista previa activa — guardá para persistir."
            : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            variant="ghost"
            size="sm"
          >
            Descartar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isValid || !isDirty || isSaving || isPending}
            variant="default"
            size="sm"
          >
            {isSaving || isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ContrastMeter({ contrast }: { contrast: BrandContrast }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <ContrastPill mode="light" status={contrast.light} ratio={contrast.lightRatio} />
      <ContrastPill mode="dark" status={contrast.dark} ratio={contrast.darkRatio} />
    </div>
  );
}

function ContrastPill({
  mode,
  status,
  ratio,
}: {
  mode: "light" | "dark";
  status: ContrastStatus;
  ratio: number;
}) {
  const STATUS: Record<ContrastStatus, { chip: string; dot: string; label: string }> = {
    pass: {
      chip: "bg-[var(--positive-soft)] text-[var(--positive)]",
      dot: "bg-[var(--positive)]",
      label: "AA ✓",
    },
    warn: {
      chip: "bg-[var(--warning-soft)] text-[var(--warning)]",
      dot: "bg-[var(--warning)]",
      label: "AA · ojo",
    },
    fail: {
      chip: "bg-[var(--danger-soft)] text-[var(--danger)]",
      dot: "bg-[var(--danger)]",
      label: "AA ✗",
    },
  };
  const s = STATUS[status];
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[var(--rule)] bg-[var(--surface)] px-3 py-2">
      <div
        className={cn(
          "size-6 rounded-md border border-[var(--rule)] flex items-center justify-center",
          mode === "light" ? "bg-white text-[var(--ink)]" : "bg-[#212127] text-white",
        )}
        aria-hidden="true"
      >
        {mode === "light" ? <Sun className="size-3" /> : <Moon className="size-3" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10.5px] uppercase tracking-[0.06em] text-[var(--soft-ink)] leading-tight">
          {mode === "light" ? "Modo claro" : "Modo oscuro"}
        </p>
        <p className="text-[12px] text-[var(--ink)] tabular-nums">
          {ratio.toFixed(1)}:1
        </p>
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 h-[20px] px-1.5 rounded-full text-[11px] font-medium whitespace-nowrap",
          s.chip,
        )}
      >
        <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden="true" />
        {s.label}
      </span>
    </div>
  );
}

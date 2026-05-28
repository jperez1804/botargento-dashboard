"use client";

import type { CSSProperties } from "react";

type Props = {
  /** Hex color to preview. Falls back to the live --client-primary if omitted. */
  primary?: string;
};

// Three-up live preview of the six designated surfaces the brand color
// touches most prominently: nav rail, heatmap intensity ramp, chart
// series 1 stroke. Bound via `--brand-preview-color` (set inline below)
// with a CSS fallback to `--client-primary`, so the preview can show
// either a committed-but-not-saved hex (preview mode) or the live
// document value (no override needed).
export function BrandPreview({ primary }: Props) {
  const style: CSSProperties | undefined = primary
    ? ({
        "--brand-preview-color": primary,
      } as CSSProperties)
    : undefined;
  return (
    <div
      style={style}
      className="rounded-xl border border-[var(--rule)] bg-[var(--canvas-2)] p-4 grid grid-cols-3 gap-3"
    >
      <RailTile />
      <HeatmapTile />
      <SeriesTile />
    </div>
  );
}

function TileLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] tracking-[0.08em] uppercase text-[var(--soft-ink)] mb-1.5">
      {children}
    </div>
  );
}

function RailTile() {
  return (
    <div>
      <TileLabel>Rail</TileLabel>
      <div className="relative h-[34px] flex items-center gap-2.5 rounded-md bg-[var(--surface)] px-3 text-[12.5px] font-semibold text-[var(--ink)]">
        <span
          aria-hidden="true"
          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-sm"
          style={{
            background: "var(--brand-preview-color, var(--client-primary))",
          }}
        />
        Panel
      </div>
    </div>
  );
}

function HeatmapTile() {
  // Five-step ramp matching IntentHeatmap's formula: mix(primary, surface)
  // at 15 / 32 / 50 / 68 / 85 percent. The preview uses --brand-preview-color
  // so user-picked colors update the gradient in real time.
  const steps = [0.15, 0.32, 0.5, 0.68, 0.85];
  return (
    <div>
      <TileLabel>Heatmap</TileLabel>
      <div className="flex gap-0.5">
        {steps.map((v) => (
          <div
            key={v}
            className="h-[18px] flex-1 rounded-[3px]"
            style={{
              background: `color-mix(in oklch, var(--brand-preview-color, var(--client-primary)) ${Math.round(
                v * 100,
              )}%, var(--surface))`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SeriesTile() {
  return (
    <div>
      <TileLabel>Serie 1</TileLabel>
      <svg viewBox="0 0 120 24" width="100%" height="22" aria-hidden="true">
        <path
          d="M0 18 L24 12 L48 14 L72 6 L96 10 L120 4"
          fill="none"
          stroke="var(--brand-preview-color, var(--client-primary))"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

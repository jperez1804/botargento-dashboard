import { formatLongDate } from "@/lib/date";

// Domain-semantic palette (not brand) — mirrors the priority-chip approach.
const PALETTE: Record<string, { bg: string; fg: string; label: string }> = {
  GREEN: { bg: "#E6F4EA", fg: "#1B5E20", label: "Alta" },
  YELLOW: { bg: "#FCE5CD", fg: "#8A4B00", label: "Media" },
  RED: { bg: "#F4CCCC", fg: "#8A1A1A", label: "Baja" },
};

type Props = {
  rating: string | null;
  tier: string | null;
  lastUpdated: string | null;
  locale: string;
};

export function QualityBadge({ rating, tier, lastUpdated, locale }: Props) {
  const key = (rating ?? "").toUpperCase();
  const pal = PALETTE[key];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--rule)] bg-[var(--surface)] px-4 py-3">
      <span className="font-[var(--font-geist-mono)] text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--soft-ink)]">
        Calidad del número
      </span>
      {pal ? (
        <span
          className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
          style={{ backgroundColor: pal.bg, color: pal.fg }}
        >
          {key} · {pal.label}
        </span>
      ) : (
        <span className="rounded-full bg-[var(--canvas)] px-2.5 py-1 text-[12px] font-medium text-[var(--muted-ink)]">
          Sin datos aún
        </span>
      )}
      {tier ? (
        <span className="text-[12px] text-[var(--muted-ink)]">
          Límite: {tier.replace("TIER_", "")}
        </span>
      ) : null}
      {lastUpdated ? (
        <span className="ml-auto text-[11px] text-[var(--soft-ink)]">
          Actualizado {formatLongDate(lastUpdated, locale)}
        </span>
      ) : null}
    </div>
  );
}

import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

// Owner avatar for the board cards: initials on a deterministic tint (the
// email picks the tint, so the same person keeps the same color everywhere).
// Unassigned renders as a dashed circle — visibly "nobody" rather than a
// person-shaped placeholder that reads as a real owner.

const TINTS = [
  "bg-[var(--info-soft)] text-[var(--info)]",
  "bg-[var(--positive-soft)] text-[var(--positive)]",
  "bg-[var(--warning-soft)] text-[color-mix(in_oklch,var(--warning)_65%,var(--ink))]",
  "bg-[var(--danger-soft)] text-[var(--danger)]",
  "bg-[var(--neutral-soft)] text-[var(--muted-ink)]",
];

function initials(label: string): string {
  const parts = label
    .replace(/@.*$/, "") // an email falls back to its local part
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0] ?? "");
  return (letters.join("") || label.slice(0, 2)).toUpperCase();
}

function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length] as string;
}

type Props = {
  /** Display name (or email) of the owner; null renders the empty state. */
  label: string | null;
  /** Stable seed for the tint — the owner's email. */
  seed?: string;
  emptyLabel: string;
  className?: string;
};

export function LeadAvatar({ label, seed, emptyLabel, className }: Props) {
  const base =
    "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tracking-[0.02em] select-none";
  if (!label) {
    return (
      <span
        title={emptyLabel}
        aria-label={emptyLabel}
        className={cn(
          base,
          "border border-dashed border-[var(--rule-strong)] text-[var(--faint-ink)]",
          className,
        )}
      >
        <UserRound className="size-3" aria-hidden />
      </span>
    );
  }
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(base, tintFor(seed || label), className)}
    >
      {initials(label)}
    </span>
  );
}

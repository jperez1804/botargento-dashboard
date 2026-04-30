import { formatNumber } from "@/lib/format";
import type { OtrasBreakdownRow } from "@/lib/queries/intents";

type Props = {
  rows: ReadonlyArray<OtrasBreakdownRow>;
  locale: string;
};

export function OtrasBreakdown({ rows, locale }: Props) {
  if (rows.length === 0) return null;

  return (
    <details className="rounded-md border border-[#e5e7eb] bg-white px-4 py-2 text-sm">
      <summary className="cursor-pointer select-none text-[#374151] font-medium">
        Top valores en Otras (últimos 7 días)
      </summary>
      <ul className="mt-2 space-y-1 text-xs text-[#6b7280]">
        {rows.map((row) => (
          <li key={row.rawToken} className="flex items-center justify-between gap-3">
            <code className="font-[var(--font-geist-mono)] text-[#374151] truncate">
              {row.rawToken}
            </code>
            <span className="tabular-nums whitespace-nowrap">
              {formatNumber(row.count, locale)} contactos
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

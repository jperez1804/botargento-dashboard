"use client";

// Filters for /leads › Actividad: event kind and person, kept in the URL
// (?view=activity&kind=…&by=…) like the rest of the leads filters.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LEAD_FIELD_CLASS } from "@/components/dashboard/lead-field-class";
import type { CrmLabels } from "@/config/verticals/_types";

type Props = {
  labels: CrmLabels;
  kinds: ReadonlyArray<{ key: string; label: string }>;
  people: ReadonlyArray<{ email: string; label: string }>;
  current: { kind: string; by: string };
};

export function TeamActivityFilters({ labels, kinds, people, current }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(key: "kind" | "by", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const selectClass = cn(LEAD_FIELD_CLASS, "h-9 w-auto min-w-[180px] cursor-pointer");
  return (
    <div className="flex flex-wrap gap-3">
      <select
        aria-label={labels.filterAllKinds}
        data-testid="activity-kind-filter"
        value={current.kind}
        onChange={(e) => navigate("kind", e.target.value)}
        className={selectClass}
      >
        <option value="">{labels.filterAllKinds}</option>
        {kinds.map((k) => (
          <option key={k.key} value={k.key}>
            {k.label}
          </option>
        ))}
      </select>
      <select
        aria-label={labels.filterAllPeople}
        value={current.by}
        onChange={(e) => navigate("by", e.target.value)}
        className={selectClass}
      >
        <option value="">{labels.filterAllPeople}</option>
        {people.map((p) => (
          <option key={p.email} value={p.email}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}

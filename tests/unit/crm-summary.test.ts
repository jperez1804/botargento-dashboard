import { describe, expect, it } from "vitest";
import { realEstate } from "@/config/verticals/real-estate";
import type { EffectiveLead } from "@/lib/crm/effective-stage";
import { buildLeadsSummary, closedStageKeys } from "@/lib/crm/summary";
import type { LeadRow } from "@/lib/queries/leads";

const config = realEstate.crm!;
const NOW = new Date("2026-09-21T15:00:00Z");
const DAY = 86_400_000;
const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY);
const daysAhead = (d: number) => new Date(NOW.getTime() + d * DAY);

const team = [
  { email: "dev@x.com", displayName: "Dev", role: "admin", active: true },
  { email: "ana@x.com", displayName: "Ana", role: "asesor", active: true },
  { email: "old@x.com", displayName: "Old", role: "asesor", active: false },
  { email: "viewer@x.com", displayName: "V", role: "viewer", active: true },
];

let n = 0;
function row(over: Partial<EffectiveLead> & { firstSeen?: Date | null; origin?: string } = {}): LeadRow {
  const { firstSeen = daysAgo(20), origin, ...lead } = over;
  n += 1;
  return {
    contactWaId: `549110000${String(n).padStart(4, "0")}`,
    displayName: `Lead ${n}`,
    firstSeen,
    lastMessageAt: null,
    handoffCount: 0,
    budget: null,
    manual: origin ? { source: origin, intent: "", createdBy: "ana@x.com", createdAt: firstSeen ?? NOW } : null,
    lastIntent: null,
    lead: {
      stage: "nuevo",
      source: "auto",
      stageSince: null,
      lastActivityAt: daysAgo(20),
      daysInactive: 20,
      lost: null,
      atRisk: null,
      reminder: null,
      owner: null,
      priority: null,
      ...lead,
    },
  };
}

describe("buildLeadsSummary", () => {
  it("knows which stages count as closed", () => {
    expect(closedStageKeys(config)).toEqual(["cerrado"]);
  });

  it("counts the 7-day KPIs on their boundaries", () => {
    const rows = [
      row({ stage: "cerrado", stageSince: daysAgo(6) }),
      row({ stage: "cerrado", stageSince: daysAgo(8) }), // outside the window
      row({ stage: "perdido", stageSince: daysAgo(1) }), // terminal but not closed
      row({ lastActivityAt: daysAgo(7) }), // 7 days: inclusive
      row({ lastActivityAt: daysAgo(8) }),
      row({ firstSeen: daysAgo(2) }),
      row({ firstSeen: daysAgo(30) }),
      row({ reminder: { at: daysAhead(3), note: "", status: "upcoming" } }),
      row({ reminder: { at: daysAhead(6), note: "", status: "upcoming" } }),
      row({ reminder: { at: daysAhead(12), note: "", status: "scheduled" } }), // beyond 7 days
      row({ reminder: { at: daysAgo(1), note: "", status: "overdue" } }),
      row({ reminder: { at: daysAgo(1), note: "", status: "done" } }),
    ];
    const s = buildLeadsSummary(rows, config, team, NOW);
    expect(s.windowDays).toBe(7);
    expect(s.kpis).toEqual({ closed: 1, active: 1, new: 1, dueSoon: 2, overdue: 1 });
  });

  it("slices stages in config order, lost included, with percentages", () => {
    const rows = [row(), row(), row({ stage: "perdido" }), row({ stage: "visita" })];
    const s = buildLeadsSummary(rows, config, team, NOW);
    expect(s.stages.total).toBe(4);
    expect(s.stages.slices.map((x) => x.key)).toEqual(config.stages.map((x) => x.key));
    const nuevo = s.stages.slices.find((x) => x.key === "nuevo")!;
    expect(nuevo).toMatchObject({ label: "Nuevo", tone: "neutral", count: 2, pct: 0.5 });
    expect(s.stages.slices.find((x) => x.key === "perdido")!.count).toBe(1);
  });

  it("counts priorities on open leads only", () => {
    const rows = [
      row({ priority: "alta" }),
      row({ priority: "alta", stage: "cerrado" }), // closed: not counted
      row({ priority: "baja" }),
      row(),
    ];
    const s = buildLeadsSummary(rows, config, team, NOW);
    expect(s.priorities.total).toBe(3);
    expect(s.priorities.rows.map((r) => [r.key, r.count])).toEqual([
      ["alta", 1],
      ["media", 0],
      ["baja", 1],
      ["none", 1],
    ]);
    expect(s.priorities.rows[0]).toMatchObject({ label: "Alta", tone: "danger" });
  });

  it("lists the team's workload: unassigned first, idle members at 0, old owners last", () => {
    const rows = [
      row({ owner: "ana@x.com" }),
      row({ owner: "ana@x.com" }),
      row({ owner: "old@x.com" }),
      row({ owner: "ana@x.com", stage: "perdido" }), // not open
      row(),
    ];
    const s = buildLeadsSummary(rows, config, team, NOW);
    expect(s.workload.total).toBe(4);
    expect(s.workload.rows.map((r) => [r.label, r.count])).toEqual([
      ["Sin asignar", 1],
      ["Dev", 0],
      ["Ana", 2],
      ["Old", 1],
    ]);
    expect(s.workload.rows.find((r) => r.label === "Ana")!.pct).toBe(0.5);
  });

  it("breaks leads down by origin, WhatsApp by default", () => {
    const rows = [row(), row({ origin: "visita" }), row({ origin: "telefono" }), row({ origin: "visita" })];
    const s = buildLeadsSummary(rows, config, team, NOW);
    expect(s.sources.rows.map((r) => [r.key, r.count])).toEqual([
      ["whatsapp", 1],
      ["telefono", 1],
      ["visita", 2],
      ["portal", 0],
      ["referido", 0],
      ["otro", 0],
    ]);
    expect(s.sources.rows[0]?.label).toBe("WhatsApp");
  });

  it("is all zeros without NaN when there are no leads", () => {
    const s = buildLeadsSummary([], config, team, NOW);
    expect(s.kpis).toEqual({ closed: 0, active: 0, new: 0, dueSoon: 0, overdue: 0 });
    expect(s.stages.slices.every((x) => x.count === 0 && x.pct === 0)).toBe(true);
    expect(s.workload.rows.every((x) => Number.isFinite(x.pct))).toBe(true);
  });
});

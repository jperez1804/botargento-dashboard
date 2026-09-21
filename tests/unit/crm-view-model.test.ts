import { describe, expect, it } from "vitest";
import { realEstate } from "@/config/verticals/real-estate";
import {
  buildLeadView,
  fillTemplate,
  formatBudget,
  formatRelative,
  sumBudgets,
} from "@/lib/crm/view-model";
import { describeLeadEvent } from "@/lib/crm/event-text";
import type { EffectiveLead } from "@/lib/crm/effective-stage";

const config = realEstate.crm!;
const TZ = "America/Argentina/Buenos_Aires";
const label = (email: string | null) => (email === "dev@x.com" ? "Dev" : email ?? "");

function lead(overrides: Partial<EffectiveLead> = {}): EffectiveLead {
  return {
    stage: "nuevo",
    source: "auto",
    stageSince: null,
    lastActivityAt: new Date("2026-09-10T15:00:00Z"),
    daysInactive: 9,
    lost: null,
    atRisk: null,
    reminder: null,
    owner: null,
    ...overrides,
  };
}

describe("fillTemplate", () => {
  it("substitutes known keys and leaves unknown ones", () => {
    expect(fillTemplate("{n} leads · {x}", { n: 3 })).toBe("3 leads · {x}");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-09-19T15:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

  it("says hoy / ayer / hace N días for the recent past", () => {
    expect(formatRelative(ago(0), now, "es-AR")).toBe("hoy");
    expect(formatRelative(ago(1), now, "es-AR")).toBe("ayer");
    expect(formatRelative(ago(3), now, "es-AR")).toBe("hace 3 días");
    expect(formatRelative(ago(29), now, "es-AR")).toBe("hace 29 días");
  });

  it("switches to months past 30 days", () => {
    expect(formatRelative(ago(45), now, "es-AR")).toBe("hace 1 mes");
    expect(formatRelative(ago(75), now, "es-AR")).toBe("hace 2 meses");
    expect(formatRelative(ago(400), now, "es-AR")).toBe("hace 1 año");
  });
});

describe("buildLeadView", () => {
  it("words an at-risk lead with the date it will be lost", () => {
    const view = buildLeadView(
      lead({ atRisk: { lostOn: new Date("2026-09-24T15:00:00Z"), daysLeft: 5 } }),
      config,
      label,
      "es-AR",
      TZ,
    );
    expect(view).toMatchObject({
      stageLabel: "Nuevo",
      tone: "neutral",
      auto: true,
      statusText: "Pasa a perdido el 24/09",
      statusTone: "warning",
      ownerLabel: "Sin asignar",
    });
  });

  it("explains an automatic loss by inactivity", () => {
    const view = buildLeadView(
      lead({
        stage: "perdido",
        lost: { at: new Date("2026-09-01T15:00:00Z"), reason: "inactivity", detail: "", reversible: true },
      }),
      config,
      label,
      "es-AR",
      TZ,
    );
    expect(view.statusText).toBe("Perdido desde el 01/09 · sin actividad");
    expect(view.statusTone).toBe("danger");
  });

  it("uses the manual motive and the owner's display name", () => {
    const view = buildLeadView(
      lead({
        stage: "perdido",
        source: "manual",
        owner: "dev@x.com",
        lost: { at: new Date("2026-09-01T15:00:00Z"), reason: "manual", detail: "No responde", reversible: true },
      }),
      config,
      label,
      "es-AR",
      TZ,
    );
    expect(view.statusText).toBe("Perdido desde el 01/09 · No responde");
    expect(view.ownerLabel).toBe("Dev");
    expect(view.auto).toBe(false);
  });

  it("formats an overdue reminder in the tenant timezone", () => {
    const view = buildLeadView(
      lead({ reminder: { at: new Date("2026-09-18T13:30:00Z"), note: "Llamar", status: "overdue" } }),
      config,
      label,
      "es-AR",
      TZ,
    );
    expect(view.reminder).toMatchObject({ status: "overdue", note: "Llamar", text: "Vencido · 18/09, 10:30" });
  });
});

describe("budgets", () => {
  const usd = (amount: number) => ({ amount, currency: "USD", text: "" });

  it("formats the amount, or falls back to the captured range", () => {
    expect(formatBudget(usd(150000), "es-AR")).toBe("USD 150.000");
    expect(formatBudget({ amount: null, currency: "", text: "USD 120k – 160k" }, "es-AR")).toBe("USD 120k – 160k");
    expect(formatBudget({ amount: null, currency: "", text: "" }, "es-AR")).toBeNull();
    expect(formatBudget(null, "es-AR")).toBeNull();
  });

  it("totals per currency and never mixes currencies or ranges", () => {
    const total = sumBudgets(
      [usd(150000), usd(300000), { amount: 30000000, currency: "ARS", text: "" }, { amount: null, currency: "", text: "USD 1M" }, null],
      "es-AR",
    );
    expect(total).toContain("USD 450.000");
    expect(total).toContain("ARS 30.000.000");
    expect(total?.split(" · ")).toHaveLength(2);
    expect(sumBudgets([null, { amount: null, currency: "", text: "x" }], "es-AR")).toBeNull();
  });

  it("buildLeadView carries the budget and the days in the stage", () => {
    const now = new Date("2026-09-19T15:00:00Z");
    const view = buildLeadView(
      lead({ stageSince: new Date("2026-09-16T15:00:00Z") }),
      config,
      label,
      "es-AR",
      TZ,
      now,
      usd(90000),
    );
    expect(view.budgetText).toBe("USD 90.000");
    expect(view.daysInStageText).toBe("3 d en la etapa");
  });
});

describe("describeLeadEvent", () => {
  const ev = (kind: string, metadata: Record<string, unknown> = {}, body = "") => ({ kind, body, metadata });

  it("reads stage moves, assignments and manual creation from metadata", () => {
    expect(describeLeadEvent(ev("stage_change", { from: "nuevo", to: "visita" }), config, label)).toBe(
      "Nuevo → Visita",
    );
    expect(describeLeadEvent(ev("assignment", { to: "dev@x.com" }), config, label)).toBe("→ Dev");
    expect(describeLeadEvent(ev("created", { source: "visita" }), config, label)).toBe(
      "Origen: Visita a la oficina",
    );
  });

  it("falls back to the body for person-logged activity", () => {
    expect(describeLeadEvent(ev("call", {}, "Coordinamos visita"), config, label)).toBe("Coordinamos visita");
  });
});

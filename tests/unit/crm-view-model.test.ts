import { describe, expect, it } from "vitest";
import { realEstate } from "@/config/verticals/real-estate";
import {
  buildLeadView,
  fillTemplate,
  formatBudget,
  calendarDaysBetween,
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
    priority: null,
    closedAt: null,
    ...overrides,
  };
}

describe("fillTemplate", () => {
  it("substitutes known keys and leaves unknown ones", () => {
    expect(fillTemplate("{n} leads · {x}", { n: 3 })).toBe("3 leads · {x}");
  });
});

describe("formatRelative", () => {
  const TZ = "America/Argentina/Buenos_Aires";
  const now = new Date("2026-09-19T15:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

  it("says hoy / ayer / hace N días for the recent past", () => {
    expect(formatRelative(ago(0), now, "es-AR", TZ)).toBe("hoy");
    expect(formatRelative(ago(1), now, "es-AR", TZ)).toBe("ayer");
    expect(formatRelative(ago(3), now, "es-AR", TZ)).toBe("hace 3 días");
    expect(formatRelative(ago(29), now, "es-AR", TZ)).toBe("hace 29 días");
  });

  it("switches to months past 30 days", () => {
    expect(formatRelative(ago(45), now, "es-AR", TZ)).toBe("hace 1 mes");
    expect(formatRelative(ago(75), now, "es-AR", TZ)).toBe("hace 2 meses");
    expect(formatRelative(ago(400), now, "es-AR", TZ)).toBe("hace 1 año");
  });

  it("counts calendar days in the tenant timezone, not elapsed hours", () => {
    // 20:44 in Buenos Aires; the reminder is tomorrow 06:00 local — nine hours away.
    const tonight = new Date("2026-09-25T23:44:00Z");
    const tomorrowMorning = new Date("2026-09-26T09:00:00Z");
    expect(formatRelative(tomorrowMorning, tonight, "es-AR", TZ)).toBe("mañana");
    // Two hours later, same local day.
    expect(formatRelative(new Date("2026-09-26T01:00:00Z"), tonight, "es-AR", TZ)).toBe("hoy");
    // 02:30Z is still the 25th in Buenos Aires but already the 26th in UTC:
    // the timezone decides which day it is.
    const lateEvening = new Date("2026-09-26T02:30:00Z");
    expect(calendarDaysBetween(lateEvening, tonight, TZ)).toBe(0);
    expect(calendarDaysBetween(lateEvening, tonight, "UTC")).toBe(1);
    // 40 hours ahead crossing two midnights is "pasado mañana", not "mañana".
    expect(calendarDaysBetween(new Date("2026-09-27T15:44:00Z"), tonight, TZ)).toBe(2);
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
      statusText: "Se pierde el 24/09",
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
      lead({ reminder: { at: new Date("2026-09-18T13:30:00Z"), note: "Llamar", status: "overdue", notifiedAt: null } }),
      config,
      label,
      "es-AR",
      TZ,
    );
    expect(view.reminder).toMatchObject({ status: "overdue", note: "Llamar", text: "Vencido · 18/09, 10:30" });
    expect(view.reminder?.relativeText).toMatch(/^Vencido /);
  });
});

describe("budgets", () => {
  const usd = (amount: number) => ({ amount, currency: "USD", text: "", source: "bot" as const });

  it("formats the amount, or falls back to the captured range", () => {
    expect(formatBudget(usd(150000), "es-AR")).toBe("USD 150.000");
    expect(formatBudget({ amount: null, currency: "", text: "USD 120k – 160k", source: "bot" as const }, "es-AR")).toBe("USD 120k – 160k");
    expect(formatBudget({ amount: null, currency: "", text: "", source: "bot" as const }, "es-AR")).toBeNull();
    expect(formatBudget(null, "es-AR")).toBeNull();
  });

  it("totals per currency and never mixes currencies or ranges", () => {
    const total = sumBudgets(
      [usd(150000), usd(300000), { amount: 30000000, currency: "ARS", text: "", source: "bot" as const }, { amount: null, currency: "", text: "USD 1M", source: "bot" as const }, null],
      "es-AR",
    );
    expect(total).toContain("USD 450.000");
    expect(total).toContain("ARS 30.000.000");
    expect(total?.split(" · ")).toHaveLength(2);
    expect(sumBudgets([null, { amount: null, currency: "", text: "x", source: "bot" as const }], "es-AR")).toBeNull();
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

describe("budget precedence and events", () => {
  it("prefers the manual figure over the bot's amount and range", async () => {
    const { toBudget } = await import("@/lib/crm/budget");
    expect(toBudget("90000", "usd", "150000", "USD", { min: 1, max: 2 })).toEqual({
      amount: 90000,
      currency: "USD",
      text: "",
      source: "manual",
    });
    expect(toBudget(null, "", "150000", "USD", null)).toMatchObject({ amount: 150000, source: "bot" });
    expect(toBudget(null, "", null, "", { min: 90000, max: 110000, currency: "USD" })).toMatchObject({
      amount: null,
      text: "USD 90.000 – 110.000",
      source: "bot",
    });
    expect(toBudget(null, "", null, "", null)).toBeNull();
  });

  it("describes budget events with the formatted amount", () => {
    const ev = (metadata: Record<string, unknown>) => ({ kind: "budget", body: "", metadata });
    expect(describeLeadEvent(ev({ from: null, to: { amount: 150000, currency: "USD" } }), config, label)).toBe(
      "→ USD 150.000",
    );
    expect(describeLeadEvent(ev({ from: { amount: 1, currency: "USD" }, to: null }), config, label)).toBe(
      "→ Sin presupuesto",
    );
  });

  it("gives the reminder a relative headline", () => {
    const now = new Date("2026-09-21T15:00:00Z");
    const view = buildLeadView(
      lead({ reminder: { at: new Date("2026-09-22T15:00:00Z"), note: "Llamar", status: "upcoming", notifiedAt: null } }),
      config,
      label,
      "es-AR",
      TZ,
      now,
    );
    expect(view.reminder?.relativeText).toBe("Vence mañana");
    const overdue = buildLeadView(
      lead({ reminder: { at: new Date("2026-09-19T15:00:00Z"), note: "", status: "overdue", notifiedAt: null } }),
      config,
      label,
      "es-AR",
      TZ,
      now,
    );
    expect(overdue.reminder?.relativeText).toBe("Vencido anteayer");
  });

  it("says when the WhatsApp notice went out, and says nothing until it does", () => {
    const now = new Date("2026-09-21T15:00:00Z");
    const reminder = (notifiedAt: Date | null) =>
      buildLeadView(
        lead({ reminder: { at: new Date("2026-09-20T15:00:00Z"), note: "", status: "overdue", notifiedAt } }),
        config,
        label,
        "es-AR",
        TZ,
        now,
      ).reminder;

    // The column only ever holds what n8n wrote, so this is a read-only view
    // of a fact: the owner was pinged at that moment.
    expect(reminder(new Date("2026-09-21T12:15:00Z"))?.notifiedText).toBe(
      "Avisado por WhatsApp · 21/09, 09:15",
    );
    expect(reminder(null)?.notifiedText).toBeNull();
  });
});

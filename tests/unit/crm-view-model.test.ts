import { describe, expect, it } from "vitest";
import { realEstate } from "@/config/verticals/real-estate";
import { buildLeadView, fillTemplate, formatRelative } from "@/lib/crm/view-model";
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

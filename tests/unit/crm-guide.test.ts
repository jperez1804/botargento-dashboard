import { describe, expect, it } from "vitest";
import { realEstate } from "@/config/verticals/real-estate";
import { outboundSales } from "@/config/verticals/outbound-sales";
import { buildGuideRules, buildStageGuide } from "@/lib/crm/guide";

const config = realEstate.crm!;

describe("buildStageGuide — outbound sales", () => {
  const rows = buildStageGuide(outboundSales.crm!);

  it("documents the sales pipeline: two automatic stages, three set by a person, one shared", () => {
    expect(rows.map((r) => r.key)).toEqual(["nuevo", "calificado", "demo", "propuesta", "cerrado", "perdido"]);
    expect(rows.map((r) => r.mover)).toEqual(["bot", "bot", "person", "person", "person", "both"]);
  });

  it("explains Nuevo as a reply to a campaign, not as somebody writing first", () => {
    expect(rows.find((r) => r.key === "nuevo")?.trigger).toMatch(/campaña/i);
  });
});

describe("buildStageGuide", () => {
  const rows = buildStageGuide(config);

  it("documents every stage in config order with its own help text", () => {
    expect(rows.map((r) => r.key)).toEqual(config.stages.map((s) => s.key));
    expect(rows.every((r) => r.help.length > 0)).toBe(true);
  });

  it("says who moves each stage", () => {
    const by = (key: string) => rows.find((r) => r.key === key)!;
    expect(by("nuevo").mover).toBe("bot");
    expect(by("calificado").mover).toBe("bot");
    expect(by("visita").mover).toBe("person");
    expect(by("visita").moverLabel).toBe("La marca un asesor");
    expect(by("perdido").mover).toBe("both");
    expect(by("perdido").trigger).toContain("30 días");
  });
});

describe("buildGuideRules", () => {
  it("fills the inactivity rule with the vertical's numbers and lost label", () => {
    const rules = buildGuideRules(config);
    expect(rules.inactivity).toContain("30 días");
    expect(rules.inactivity).toContain("7 días");
    expect(rules.inactivity).toContain("Perdido");
    expect(rules.reversible).toContain("Perdido");
    expect(rules.activityKinds).toContain("Llamada");
    expect(rules.activityKinds).not.toContain("Asignación");
  });
});

import { describe, expect, it } from "vitest";
import { realEstate } from "@/config/verticals/real-estate";
import { outboundSales } from "@/config/verticals/outbound-sales";
import { outboundWholesale } from "@/config/verticals/outbound-wholesale";
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

describe("buildStageGuide — wholesale", () => {
  const rows = buildStageGuide(outboundWholesale.crm!);

  it("walks an order from the reply to the delivery", () => {
    expect(rows.map((r) => r.key)).toEqual(["nuevo", "calificado", "cotizado", "pedido", "cerrado", "perdido"]);
    // A reply opens it, so the bot puts it in Nuevo; the rest is the seller's.
    expect(rows.map((r) => r.mover)).toEqual(["bot", "bot", "person", "person", "person", "both"]);
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
    // Inbound: the bot opens every opportunity already qualified; only a
    // person puts one in Nuevo.
    expect(by("nuevo").mover).toBe("person");
    expect(by("nuevo").trigger).toMatch(/Nuevo lead/);
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

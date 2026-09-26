// Every vertical that ships a CRM must satisfy the same structural contract.
// Nothing else checks this: a stage key typo in autoStages, an activityStages
// target that is not a stage, or a kindFromCampaign pointing at a rubro that
// does not exist would all compile and then misbehave at runtime.
import { describe, expect, it } from "vitest";
import { architecture } from "@/config/verticals/architecture";
import { outboundSales } from "@/config/verticals/outbound-sales";
import { realEstate } from "@/config/verticals/real-estate";
import type { CrmConfig, VerticalConfig } from "@/config/verticals/_types";

const verticals: VerticalConfig[] = [realEstate, architecture, outboundSales];
const withCrm = verticals.filter((v): v is VerticalConfig & { crm: CrmConfig } => Boolean(v.crm));

describe("CRM config invariants", () => {
  it("is declared on real-estate, architecture and outbound-sales", () => {
    expect(withCrm.map((v) => v.key).sort()).toEqual(["architecture", "outbound-sales", "real-estate"]);
    for (const v of withCrm) expect(v.features?.crmTab).toBe(true);
  });

  describe.each(withCrm.map((v) => [v.key, v.crm] as const))("%s", (_key, crm) => {
    const stageKeys = crm.stages.map((s) => s.key);

    it("has unique stage keys and exactly the terminal stages it names", () => {
      expect(new Set(stageKeys).size).toBe(stageKeys.length);
      const terminal = crm.stages.filter((s) => s.terminal).map((s) => s.key);
      expect(terminal).toContain(crm.autoStages.lost);
      expect(terminal.length).toBeGreaterThanOrEqual(2); // won + lost
    });

    it("points every automatic stage at a real stage, in forward order", () => {
      const rank = (k: string) => stageKeys.indexOf(k);
      expect(rank(crm.autoStages.new)).toBeGreaterThanOrEqual(0);
      expect(rank(crm.autoStages.qualified)).toBeGreaterThan(rank(crm.autoStages.new));
      expect(rank(crm.autoStages.lost)).toBeGreaterThan(rank(crm.autoStages.qualified));
      // The bot never lands on a manual-only stage.
      for (const k of [crm.autoStages.new, crm.autoStages.qualified]) {
        expect(crm.stages.find((s) => s.key === k)?.manualOnly).not.toBe(true);
      }
    });

    it("maps activities to stages that exist", () => {
      for (const target of Object.values(crm.activityStages ?? {})) {
        expect(stageKeys).toContain(target);
      }
    });

    it("keeps the inactivity clock sane", () => {
      expect(crm.autoLostDays).toBeGreaterThan(crm.warnDays);
      expect(crm.warnDays).toBeGreaterThan(0);
    });

    it("declares consistent rubros when it overrides the Panel's intents", () => {
      if (!crm.kinds) {
        expect(crm.kindFromCampaign).toBeUndefined();
        return;
      }
      const kindKeys = crm.kinds.map((k) => k.key);
      expect(new Set(kindKeys).size).toBe(kindKeys.length);
      for (const kind of Object.values(crm.kindFromCampaign ?? {})) expect(kindKeys).toContain(kind);
    });

    it("only asks for a campaign rubro when a reply is what opens", () => {
      if (crm.kindFromCampaign) expect(crm.opener).toBe("reply");
    });

    it("gives every stage a help line for the Guía", () => {
      for (const s of crm.stages) expect((s.help ?? "").length).toBeGreaterThan(10);
    });
  });
});

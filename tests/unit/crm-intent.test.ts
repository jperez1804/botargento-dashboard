import { describe, expect, it } from "vitest";
import { realEstate } from "@/config/verticals/real-estate";
import { outboundSales } from "@/config/verticals/outbound-sales";
import { architecture } from "@/config/verticals/architecture";
import { crmKindOf, crmKinds, intentOptions, leadIntent } from "@/lib/crm/intent";

const intents = realEstate.intents;

describe("leadIntent", () => {
  it("maps the raw lead_log intent to the vertical bucket, keyed for filters", () => {
    expect(leadIntent("Ventas", intents)).toEqual({ key: "Ventas", label: "Ventas" });
    expect(leadIntent("alquileres", intents)).toEqual({ key: "Alquileres", label: "Alquileres" });
    expect(leadIntent("Administracion", intents)).toEqual({ key: "Administracion", label: "Administración" });
  });

  it("is null for leads that never wrote or only touched the menu", () => {
    expect(leadIntent(null, intents)).toBeNull();
    expect(leadIntent("", intents)).toBeNull();
    expect(leadIntent("menu", intents)).toBeNull();
  });

  it("lists one option per vertical intent", () => {
    expect(intentOptions(intents).map((i) => i.key)).toEqual(intents.map((i) => i.key));
  });
});

describe("crmKindOf", () => {
  const arch = architecture.crm!;

  it("maps an architecture handoff token straight to its rubro", () => {
    expect(crmKindOf("proyecto_lead", arch)).toEqual({ key: "proyecto_lead", label: "Proyecto" });
    expect(crmKindOf("gestiones_lead", arch)?.key).toBe("gestiones_lead");
    expect(crmKindOf("construccion_lead", arch)?.key).toBe("construccion_lead");
  });

  it("is strict when the vertical declares its rubros: intakes and bot noise are not rubros", () => {
    for (const raw of ["proveedor_intake", "mano_obra_intake", "unsupported_content", "freetext_ack", "guided_proyecto_handoff", "business"]) {
      expect(crmKindOf(raw, arch)).toBeNull();
    }
    expect(crmKindOf("menu", arch)).toBeNull();
  });

  it("keeps the old behaviour without declared rubros — an unknown token is still a rubro", () => {
    expect(crmKindOf("Ventas", realEstate.crm!, intents)?.key).toBe("Ventas");
    expect(crmKindOf("algo_raro", realEstate.crm!, intents)).not.toBeNull();
  });
});

describe("crmKinds", () => {
  // The running tenant is real-estate here (VERTICAL in .env.local / CI), so
  // the tenant-less fallback reads its intents.
  it("falls back to the vertical's intents when the CRM declares no rubros of its own", () => {
    expect(crmKinds(realEstate.crm!, realEstate.intents).map((k) => k.key)).toEqual(realEstate.intents.map((i) => i.key));
  });

  it("uses the CRM's own rubros when it declares them — outbound sells to inmobiliarias, not to 'ventas_lead'", () => {
    expect(crmKinds(outboundSales.crm!).map((k) => k.key)).toEqual(["inmobiliaria", "arquitectura", "otro"]);
    // and a raw outbound handoff token does NOT resolve to one of them
    expect(leadIntent("ventas_lead", crmKinds(outboundSales.crm!))?.key).not.toBe("inmobiliaria");
  });
});

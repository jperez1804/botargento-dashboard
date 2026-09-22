import { describe, expect, it } from "vitest";
import { realEstate } from "@/config/verticals/real-estate";
import { intentOptions, leadIntent } from "@/lib/crm/intent";

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

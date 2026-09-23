import { describe, expect, it } from "vitest";
import { realEstate } from "@/config/verticals/real-estate";
import { stageOfferForActivity, stageOffers } from "@/lib/crm/activity-stage";
import { extractUrls, listingLinkLabel } from "@/lib/crm/links";

const config = realEstate.crm!;

describe("stageOfferForActivity", () => {
  it("offers Visita after a visit or meeting logged on an earlier open stage", () => {
    expect(stageOfferForActivity(config, "calificado", "visit")).toEqual({ key: "visita", label: "Visita" });
    expect(stageOfferForActivity(config, "nuevo", "meeting")).toEqual({ key: "visita", label: "Visita" });
  });

  it("stays quiet for notes and calls, at or past the stage, and on closed leads", () => {
    expect(stageOfferForActivity(config, "calificado", "note")).toBeNull();
    expect(stageOfferForActivity(config, "calificado", "call")).toBeNull();
    expect(stageOfferForActivity(config, "visita", "visit")).toBeNull();
    expect(stageOfferForActivity(config, "reserva", "visit")).toBeNull();
    expect(stageOfferForActivity(config, "perdido", "visit")).toBeNull();
    expect(stageOfferForActivity(config, "cerrado", "meeting")).toBeNull();
  });

  it("collects one offer per kind", () => {
    expect(Object.keys(stageOffers(config, "contactado")).sort()).toEqual(["meeting", "visit"]);
    expect(stageOffers(config, "visita")).toEqual({});
    expect(stageOffers({ ...config, activityStages: undefined }, "nuevo")).toEqual({});
  });
});

describe("listing links", () => {
  it("labels a listing by host and trailing id", () => {
    expect(listingLinkLabel("https://www.zonaprop.com.ar/propiedades/clasificado/depto-2-amb-54231234.html")).toBe(
      "zonaprop.com.ar · 54231234",
    );
    expect(listingLinkLabel("https://www.argenprop.com/departamento-en-venta--12345678")).toBe(
      "argenprop.com · 12345678",
    );
    expect(listingLinkLabel("https://inmobiliaria.com.ar/ficha/palermo-balcon")).toBe("inmobiliaria.com.ar");
    expect(listingLinkLabel("not a url")).toBe("not a url");
  });

  it("splits a field into its URLs", () => {
    expect(extractUrls("https://a.com/1, https://b.com/2\nplain text")).toEqual(["https://a.com/1", "https://b.com/2"]);
    expect(extractUrls("sin links")).toEqual([]);
  });
});

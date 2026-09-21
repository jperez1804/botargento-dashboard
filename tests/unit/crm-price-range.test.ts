import { describe, expect, it } from "vitest";
import { priceRangeText } from "@/lib/crm/price-range";

describe("priceRangeText", () => {
  it("uses the label the lead picked (engine snapshot object)", () => {
    expect(
      priceRangeText({ max: 680000, min: 620000, label: "Desde $ 620.000", currency: "ARS" }),
    ).toBe("Desde $ 620.000");
  });

  it("formats min/max when there is no label", () => {
    expect(priceRangeText({ min: 120000, max: 160000, currency: "usd" })).toBe("USD 120.000 – 160.000");
    expect(priceRangeText({ min: 620000, currency: "ARS" })).toBe("Desde ARS 620.000");
    expect(priceRangeText({ max: 90000, currency: "USD" })).toBe("Hasta USD 90.000");
  });

  it("keeps plain text and ignores empty or unknown shapes", () => {
    expect(priceRangeText(" USD 120k – 160k ")).toBe("USD 120k – 160k");
    expect(priceRangeText(null)).toBe("");
    expect(priceRangeText({})).toBe("");
    expect(priceRangeText([1, 2])).toBe("");
  });
});

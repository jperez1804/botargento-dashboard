import { describe, it, expect } from "vitest";
import { formatDuration, formatNumber, formatPercent, formatSignedPercent } from "@/lib/format";

describe("formatNumber", () => {
  it("formats integers with es-AR thousands separators", () => {
    expect(formatNumber(1234567, "es-AR")).toBe("1.234.567");
  });

  it("rounds to nearest integer", () => {
    expect(formatNumber(1234.6, "es-AR")).toBe("1.235");
  });

  it("formats with en-US locale", () => {
    expect(formatNumber(1234567, "en-US")).toBe("1,234,567");
  });
});

describe("formatPercent", () => {
  it("multiplies 0..1 by 100 and adds a percent sign", () => {
    expect(formatPercent(0.05, "es-AR")).toMatch(/^5,0\s?%$/);
  });

  it("rounds to 1 decimal by default", () => {
    expect(formatPercent(0.0299, "es-AR")).toMatch(/^3,0\s?%$/);
  });

  it("respects fractionDigits override", () => {
    const out = formatPercent(0.0299, "es-AR", 2);
    expect(out).toContain("2,99");
  });
});

describe("formatSignedPercent", () => {
  it("prepends + for positive", () => {
    expect(formatSignedPercent(0.358, "es-AR")).toMatch(/^\+/);
    expect(formatSignedPercent(0.358, "es-AR")).toContain("35,8");
  });

  it("prepends Unicode minus for negative", () => {
    expect(formatSignedPercent(-0.474, "es-AR")).toMatch(/^−/);
  });

  it("emits 0 with no sign", () => {
    const out = formatSignedPercent(0, "es-AR");
    expect(out.startsWith("+")).toBe(false);
    expect(out.startsWith("−")).toBe(false);
  });
});

describe("formatDuration", () => {
  it("emits seconds for sub-minute durations", () => {
    expect(formatDuration(45, "es-AR")).toBe("45 s");
    expect(formatDuration(0, "es-AR")).toBe("0 s");
  });

  it("emits whole minutes when under an hour", () => {
    expect(formatDuration(90, "es-AR")).toBe("2 min");
    expect(formatDuration(720, "es-AR")).toBe("12 min");
  });

  it("emits hours and minutes when over an hour", () => {
    expect(formatDuration(8040, "es-AR")).toBe("2 h 14 min");
    expect(formatDuration(7200, "es-AR")).toBe("2 h");
  });

  it("emits days and hours when over a day", () => {
    expect(formatDuration(86400, "es-AR")).toBe("1 d");
    expect(formatDuration(259200 + 14400, "es-AR")).toBe("3 d 4 h");
  });

  it("returns em dash for invalid input", () => {
    expect(formatDuration(-1, "es-AR")).toBe("—");
    expect(formatDuration(Number.NaN, "es-AR")).toBe("—");
  });
});

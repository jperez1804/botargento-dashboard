import { describe, it, expect } from "vitest";
import { parseIsoDayUtc, formatShortDate, formatLongDate, formatDateTime } from "@/lib/date";

describe("parseIsoDayUtc", () => {
  it("parses an ISO day at UTC midnight", () => {
    const d = parseIsoDayUtc("2026-04-25");
    expect(d.toISOString()).toBe("2026-04-25T00:00:00.000Z");
  });

  it("ignores trailing time portion", () => {
    const d = parseIsoDayUtc("2026-04-25T23:30:00Z");
    expect(d.toISOString().slice(0, 10)).toBe("2026-04-25");
  });
});

describe("formatShortDate / formatLongDate", () => {
  it("does not shift days under non-UTC host TZ", () => {
    // Even if Node's host TZ were Buenos Aires (UTC-3), 2026-04-25 should
    // stay 25/04 because we explicitly pin timeZone: "UTC" in the formatter.
    expect(formatShortDate("2026-04-25", "es-AR")).toMatch(/25\/0?4/);
    expect(formatLongDate("2026-04-25", "es-AR")).toMatch(/25\/0?4\/2026/);
  });

  it("respects locale formatting differences", () => {
    const enShort = formatShortDate("2026-04-25", "en-US");
    expect(enShort).toMatch(/0?4\/25/);
  });
});

describe("formatDateTime", () => {
  it("renders BA-tz datetimes in 24h format", () => {
    // 2026-04-25T03:00:00Z = 2026-04-25 00:00 in America/Argentina/Buenos_Aires
    const out = formatDateTime("2026-04-25T03:00:00Z", "es-AR", "America/Argentina/Buenos_Aires");
    expect(out).toContain("25/04/2026");
    expect(out).toContain("00:00");
  });

  it("converts UTC to tenant tz correctly across midnight", () => {
    // 2026-04-25T01:00:00Z = 2026-04-24 22:00 in BA — check date rolled back
    const out = formatDateTime("2026-04-25T01:00:00Z", "es-AR", "America/Argentina/Buenos_Aires");
    expect(out).toContain("24/04/2026");
    expect(out).toContain("22:00");
  });
});

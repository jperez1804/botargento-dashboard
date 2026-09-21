import { describe, expect, it } from "vitest";
import { formatLeadPhone, normalizeLeadPhone } from "@/lib/crm/phone";

const ok = (raw: string) => {
  const r = normalizeLeadPhone(raw);
  return r.ok ? r.waId : null;
};

describe("normalizeLeadPhone", () => {
  it("keeps a full WhatsApp id as is", () => {
    expect(ok("5491155550000")).toBe("5491155550000");
    expect(ok("+54 9 11 5555-0000")).toBe("5491155550000");
  });

  it("completes area + number with the Argentine mobile prefix", () => {
    expect(ok("11 5555-0000")).toBe("5491155550000");
    expect(ok("(351) 555-1234")).toBe("5493515551234");
  });

  it("drops the trunk 0 and the 00 international prefix", () => {
    expect(ok("011 5555-0000")).toBe("5491155550000");
    expect(ok("0054 9 11 5555 0000")).toBe("5491155550000");
  });

  it("drops the local 15 mobile prefix", () => {
    expect(ok("011 15 4444-7777")).toBe("5491144447777");
    expect(ok("11 15 4444 7777")).toBe("5491144447777");
    expect(ok("0351 15 555-1234")).toBe("5493515551234");
    expect(ok("02944 15 55-1234")).toBe("5492944551234");
    expect(ok("+54 9 11 15 4444 7777")).toBe("5491144447777");
    expect(ok("+54 11 15 4444 7777")).toBe("5491144447777");
  });

  it("adds the mobile 9 when the country code comes without it", () => {
    expect(ok("+54 11 5555 0000")).toBe("5491155550000");
  });

  it("passes other countries through as international digits", () => {
    expect(ok("+34 613 79 32 10")).toBe("34613793210");
  });

  it("rejects numbers that are too short or too long", () => {
    expect(ok("5555-0000")).toBeNull();
    expect(ok("")).toBeNull();
    expect(ok("1234567890123456")).toBeNull();
  });
});

describe("formatLeadPhone", () => {
  it("shows Argentine mobiles with the country and mobile prefix spaced out", () => {
    expect(formatLeadPhone("5491155550000")).toBe("+54 9 1155550000");
    expect(formatLeadPhone("34613793210")).toBe("+34613793210");
  });
});

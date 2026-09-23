import { describe, expect, it } from "vitest";
import {
  combineDateTime,
  DEFAULT_REMINDER_TIME,
  presetDate,
  toDateInput,
  toTimeInput,
} from "@/lib/crm/reminder-presets";

// Local-time dates: the presets follow the asesor's own calendar.
const wednesday = new Date(2026, 8, 23, 15, 45); // 2026-09-23, a Wednesday
const monday = new Date(2026, 8, 21, 9, 0);
const sunday = new Date(2026, 8, 27, 23, 59);

describe("reminder presets", () => {
  it("formats local dates and times for the native inputs", () => {
    expect(toDateInput(wednesday)).toBe("2026-09-23");
    expect(toTimeInput(wednesday)).toBe("15:45");
    expect(toTimeInput(monday)).toBe("09:00");
    expect(DEFAULT_REMINDER_TIME).toBe("09:00");
  });

  it("points tomorrow and in 3 days at the right day, across month ends", () => {
    expect(presetDate("tomorrow", wednesday)).toBe("2026-09-24");
    expect(presetDate("in3days", wednesday)).toBe("2026-09-26");
    expect(presetDate("in3days", new Date(2026, 8, 29))).toBe("2026-10-02");
  });

  it("next week is the coming Monday, a full week when today is Monday", () => {
    expect(presetDate("nextWeek", wednesday)).toBe("2026-09-28");
    expect(presetDate("nextWeek", monday)).toBe("2026-09-28");
    expect(presetDate("nextWeek", sunday)).toBe("2026-09-28");
  });

  it("custom has no date of its own", () => {
    expect(presetDate("custom", wednesday)).toBeNull();
  });

  it("combines the two inputs into a local Date and rejects partial input", () => {
    const at = combineDateTime("2026-09-24", "09:00");
    expect(at?.getFullYear()).toBe(2026);
    expect(at?.getMonth()).toBe(8);
    expect(at?.getDate()).toBe(24);
    expect(at?.getHours()).toBe(9);
    expect(combineDateTime("", "09:00")).toBeNull();
    expect(combineDateTime("2026-09-24", "")).toBeNull();
    expect(combineDateTime("24/09/2026", "09:00")).toBeNull();
  });
});

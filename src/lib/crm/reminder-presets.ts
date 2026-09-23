// Reminder presets for the lead card: "Mañana", "En 3 días", "Próxima
// semana" (next Monday) or a date the person picks. Dates are handled as the
// browser's local calendar day (the asesor's own clock), the time defaults to
// 09:00. Pure: `now` is an argument.

export const REMINDER_PRESETS = ["tomorrow", "in3days", "nextWeek", "custom"] as const;
export type ReminderPreset = (typeof REMINDER_PRESETS)[number];

export const DEFAULT_REMINDER_TIME = "09:00";

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD of a Date in local time (what <input type="date"> wants). */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** HH:MM of a Date in local time (what <input type="time"> wants). */
export function toTimeInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The local day a preset points to, or null for "custom" (the person picks). */
export function presetDate(preset: ReminderPreset, now: Date): string | null {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "tomorrow":
      d.setDate(d.getDate() + 1);
      return toDateInput(d);
    case "in3days":
      d.setDate(d.getDate() + 3);
      return toDateInput(d);
    case "nextWeek": {
      // Next Monday; on a Monday that is a week from now.
      const day = d.getDay(); // 0 = Sunday
      const untilMonday = day === 0 ? 1 : 8 - day;
      d.setDate(d.getDate() + untilMonday);
      return toDateInput(d);
    }
    case "custom":
      return null;
  }
}

/** Local date + time inputs → Date, or null when either is missing/invalid. */
export function combineDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  const result = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(result.getTime()) ? null : result;
}

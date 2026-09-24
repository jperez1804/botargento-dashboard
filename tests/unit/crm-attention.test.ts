import { describe, expect, it } from "vitest";
import { realEstate } from "@/config/verticals/real-estate";
import type { EffectiveLead } from "@/lib/crm/effective-stage";
import { attentionKind, attentionRank, leadAttention, NO_ATTENTION_RANK } from "@/lib/crm/attention";
import { compareLeads, isTodayLead, type LeadRow } from "@/lib/queries/leads";

const config = realEstate.crm!;
const labels = config.labels;
const TZ = "America/Argentina/Buenos_Aires";
const NOW = new Date("2026-09-21T15:00:00Z"); // 12:00 in Buenos Aires
const DAY = 86_400_000;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

function lead(over: Partial<EffectiveLead> = {}): EffectiveLead {
  return {
    stage: "nuevo",
    source: "auto",
    stageSince: null,
    lastActivityAt: at(-2 * DAY),
    daysInactive: 2,
    lost: null,
    atRisk: null,
    reminder: null,
    owner: null,
    priority: null,
    closedAt: null,
    ...over,
  };
}
const reminder = (offsetMs: number, status: "overdue" | "upcoming" | "scheduled" | "done", note = "") => ({
  at: at(offsetMs),
  note,
  status,
});

describe("attention", () => {
  it("follows the precedence overdue → today → at risk → upcoming → nothing; lost last", () => {
    expect(attentionKind(lead({ reminder: reminder(-DAY, "overdue"), atRisk: { lostOn: at(DAY), daysLeft: 1 } }), NOW, TZ)).toBe("overdue");
    expect(attentionKind(lead({ reminder: reminder(3 * 3_600_000, "upcoming"), atRisk: { lostOn: at(DAY), daysLeft: 1 } }), NOW, TZ)).toBe("today");
    expect(attentionKind(lead({ atRisk: { lostOn: at(3 * DAY), daysLeft: 3 }, reminder: reminder(2 * DAY, "upcoming") }), NOW, TZ)).toBe("at_risk");
    expect(attentionKind(lead({ reminder: reminder(2 * DAY, "upcoming") }), NOW, TZ)).toBe("upcoming");
    expect(attentionKind(lead({ reminder: reminder(20 * DAY, "scheduled") }), NOW, TZ)).toBeNull();
    expect(attentionKind(lead(), NOW, TZ)).toBeNull();
    expect(attentionKind(lead({ reminder: reminder(-DAY, "done") }), NOW, TZ)).toBeNull();
    expect(
      attentionKind(lead({ stage: "perdido", lost: { at: at(-DAY), reason: "inactivity", detail: "", reversible: true }, reminder: reminder(-DAY, "overdue") }), NOW, TZ),
    ).toBe("lost");
  });

  it("uses the tenant timezone to decide what is 'today'", () => {
    // 23:30 Buenos Aires = 02:30Z next day: still today locally.
    const lateTonight = new Date("2026-09-22T02:30:00Z");
    expect(attentionKind(lead({ reminder: { at: lateTonight, note: "", status: "upcoming" } }), NOW, TZ)).toBe("today");
    expect(attentionKind(lead({ reminder: { at: lateTonight, note: "", status: "upcoming" } }), NOW, "UTC")).toBe("upcoming");
  });

  it("ranks for sorting", () => {
    expect(attentionRank(lead({ reminder: reminder(-DAY, "overdue") }), NOW, TZ)).toBe(0);
    expect(attentionRank(lead(), NOW, TZ)).toBe(NO_ATTENTION_RANK);
    expect(attentionRank(lead({ stage: "perdido", lost: { at: at(-DAY), reason: "opt_out", detail: "", reversible: false } }), NOW, TZ)).toBe(5);
  });

  it("words each kind with the labels, appending the reminder note", () => {
    const text = (l: EffectiveLead) => leadAttention(l, labels, "es-AR", TZ, NOW)?.text;
    expect(text(lead({ reminder: reminder(-DAY, "overdue", "Llamar") }))).toBe("Vencido ayer · Llamar");
    expect(text(lead({ reminder: reminder(4 * 3_600_000, "upcoming") }))).toBe("Vence hoy, 16:00");
    expect(text(lead({ atRisk: { lostOn: new Date("2026-09-30T12:00:00Z"), daysLeft: 9 } }))).toBe("Se pierde el 30/09");
    expect(text(lead({ reminder: reminder(3 * DAY, "upcoming") }))).toBe("Vence dentro de 3 días");
    expect(text(lead({ stage: "perdido", lost: { at: at(-DAY), reason: "manual", detail: "No responde", reversible: true } }))).toBe(
      "Perdido desde el 20/09 · No responde",
    );
    expect(leadAttention(lead(), labels, "es-AR", TZ, NOW)).toBeNull();
    expect(leadAttention(lead({ reminder: reminder(-DAY, "overdue") }), labels, "es-AR", TZ, NOW)?.tone).toBe("danger");
  });
});

let n = 0;
function row(over: Partial<EffectiveLead> = {}): LeadRow {
  n += 1;
  return {
    contactWaId: `549110000${String(n).padStart(4, "0")}`,
    displayName: `Lead ${n}`,
    firstSeen: at(-10 * DAY),
    lastMessageAt: null,
    handoffCount: 0,
    budget: null,
    contact: { source: "whatsapp", createdBy: "", createdAt: at(-10 * DAY), firstSeenAt: at(-10 * DAY) },
    openedAt: at(-10 * DAY),
    id: n,
    seq: 1,
    ofTotal: 1,
    kind: "",
    title: "",
    openedBy: "",
    closedAt: null,
    newIntent: null,
    lead: lead(over),
  };
}

describe("compareLeads", () => {
  it("puts attention first, then priority, then recency", () => {
    const overdueMedia = row({ reminder: reminder(-DAY, "overdue"), priority: "media", lastActivityAt: at(-9 * DAY) });
    const altaQuiet = row({ priority: "alta", lastActivityAt: at(-DAY) });
    const recentQuiet = row({ lastActivityAt: at(-3_600_000) });
    const olderQuiet = row({ lastActivityAt: at(-5 * DAY) });
    const sorted = [olderQuiet, recentQuiet, altaQuiet, overdueMedia].sort((a, b) => compareLeads(a, b, NOW, TZ));
    expect(sorted.map((r) => r.contactWaId)).toEqual([overdueMedia, altaQuiet, recentQuiet, olderQuiet].map((r) => r.contactWaId));
  });
});

describe("isTodayLead", () => {
  const asesor = { email: "ana@x.com", isAdmin: false };
  const admin = { email: "dev@x.com", isAdmin: true };

  it("is my overdue/today reminders and my at-risk leads", () => {
    expect(isTodayLead(row({ owner: "ana@x.com", reminder: reminder(-DAY, "overdue") }), asesor, config, NOW, TZ)).toBe(true);
    expect(isTodayLead(row({ owner: "ana@x.com", atRisk: { lostOn: at(DAY), daysLeft: 1 } }), asesor, config, NOW, TZ)).toBe(true);
    expect(isTodayLead(row({ owner: "ana@x.com", reminder: reminder(3 * DAY, "upcoming") }), asesor, config, NOW, TZ)).toBe(false);
    // Someone else's overdue lead is not my today — unless I am the admin.
    expect(isTodayLead(row({ owner: "dev@x.com", reminder: reminder(-DAY, "overdue") }), asesor, config, NOW, TZ)).toBe(false);
    expect(isTodayLead(row({ owner: "ana@x.com", reminder: reminder(-DAY, "overdue") }), admin, config, NOW, TZ)).toBe(true);
  });

  it("includes unassigned leads only in the early bot stages, never lost ones", () => {
    expect(isTodayLead(row({ owner: null, stage: "nuevo" }), asesor, config, NOW, TZ)).toBe(true);
    expect(isTodayLead(row({ owner: null, stage: "calificado" }), asesor, config, NOW, TZ)).toBe(true);
    expect(isTodayLead(row({ owner: null, stage: "visita" }), asesor, config, NOW, TZ)).toBe(false);
    expect(
      isTodayLead(row({ owner: null, stage: "perdido", lost: { at: at(-DAY), reason: "inactivity", detail: "", reversible: true } }), admin, config, NOW, TZ),
    ).toBe(false);
  });
});

// Table of cases for deriveLead(): the whole stage semantics of the CRM live in
// this pure function, so every precedence rule is pinned here against the real
// real-estate pipeline with a fixed clock.

import { describe, expect, it } from "vitest";
import { realEstate } from "@/config/verticals/real-estate";
import {
  deriveLead,
  type LeadSignals,
  type LeadStateRow,
} from "@/lib/crm/effective-stage";

const config = realEstate.crm!;
const NOW = new Date("2026-09-19T15:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

function signals(overrides: Partial<LeadSignals> = {}): LeadSignals {
  return {
    firstSeen: daysAgo(3),
    lastMessageAt: daysAgo(1),
    lastHandoffAt: null,
    lastHumanContactAt: null,
    optedOutAt: null,
    lastCrmActivityAt: null,
    ...overrides,
  };
}

function state(overrides: Partial<LeadStateRow> = {}): LeadStateRow {
  return {
    stage: null,
    stageChangedAt: null,
    lostReason: "",
    ownerEmail: null,
    nextActionAt: null,
    nextActionNote: "",
    nextActionDoneAt: null,
    priority: "",
    openedAt: daysAgo(3),
    closedAt: null,
    ...overrides,
  };
}

describe("deriveLead — automatic stages", () => {
  it("is nuevo with no signals and no manual stage", () => {
    const lead = deriveLead(signals(), null, config, NOW);
    expect(lead).toMatchObject({ stage: "nuevo", source: "auto", lost: null, atRisk: null });
  });

  it("is calificado after a handoff", () => {
    const lead = deriveLead(signals({ lastHandoffAt: daysAgo(1) }), null, config, NOW);
    expect(lead.stage).toBe("calificado");
    expect(lead.stageSince).toEqual(daysAgo(1));
  });

  it("is contactado after a human reply without a handoff", () => {
    const lead = deriveLead(signals({ lastHumanContactAt: daysAgo(2) }), null, config, NOW);
    expect(lead.stage).toBe("contactado");
  });

  it("prefers calificado when there is both a handoff and a human reply", () => {
    const lead = deriveLead(
      signals({ lastHandoffAt: daysAgo(2), lastHumanContactAt: daysAgo(1) }),
      null,
      config,
      NOW,
    );
    expect(lead.stage).toBe("calificado");
  });
});

describe("deriveLead — manual vs automatic precedence", () => {
  it("keeps a manual visita when the bot hands off afterwards (bot never moves back)", () => {
    const lead = deriveLead(
      signals({ lastHandoffAt: daysAgo(1) }),
      state({ stage: "visita", stageChangedAt: daysAgo(2) }),
      config,
      NOW,
    );
    expect(lead).toMatchObject({ stage: "visita", source: "manual" });
  });

  it("lets a later handoff push a manual contactado forward to calificado", () => {
    const lead = deriveLead(
      signals({ lastHandoffAt: daysAgo(1) }),
      state({ stage: "contactado", stageChangedAt: daysAgo(2) }),
      config,
      NOW,
    );
    expect(lead).toMatchObject({ stage: "calificado", source: "auto" });
  });

  it("keeps a manual stage set AFTER the handoff, even if it ranks lower", () => {
    const lead = deriveLead(
      signals({ lastHandoffAt: daysAgo(3) }),
      state({ stage: "nuevo", stageChangedAt: daysAgo(1) }),
      config,
      NOW,
    );
    expect(lead).toMatchObject({ stage: "nuevo", source: "manual" });
  });

  it("keeps cerrado sticky: new handoffs and 60 idle days change nothing", () => {
    const lead = deriveLead(
      signals({ lastMessageAt: daysAgo(60), lastHandoffAt: daysAgo(59) }),
      state({ stage: "cerrado", stageChangedAt: daysAgo(61) }),
      config,
      NOW,
    );
    expect(lead).toMatchObject({ stage: "cerrado", source: "manual", lost: null, atRisk: null });
  });

  it("reports a manual perdido with its motive, reversible", () => {
    const lead = deriveLead(
      signals(),
      state({ stage: "perdido", stageChangedAt: daysAgo(1), lostReason: "Fuera de presupuesto" }),
      config,
      NOW,
    );
    expect(lead.stage).toBe("perdido");
    expect(lead.lost).toEqual({
      at: daysAgo(1),
      reason: "manual",
      detail: "Fuera de presupuesto",
      reversible: true,
    });
  });

  it("ignores a manual stage key that is no longer in the config", () => {
    const lead = deriveLead(
      signals({ lastHandoffAt: daysAgo(1) }),
      state({ stage: "etapa_borrada", stageChangedAt: daysAgo(1) }),
      config,
      NOW,
    );
    expect(lead).toMatchObject({ stage: "calificado", source: "auto" });
  });
});

describe("deriveLead — opt-out", () => {
  it("wins over any manual stage, cerrado included, and is not reversible", () => {
    const lead = deriveLead(
      signals({ optedOutAt: daysAgo(2) }),
      state({ stage: "cerrado", stageChangedAt: daysAgo(1) }),
      config,
      NOW,
    );
    expect(lead.stage).toBe("perdido");
    expect(lead.lost).toMatchObject({ reason: "opt_out", reversible: false });
  });
});

describe("deriveLead — inactivity clock", () => {
  it("marks perdido after 30 idle days, dated at last activity + 30", () => {
    const lead = deriveLead(
      signals({ firstSeen: daysAgo(40), lastMessageAt: daysAgo(31) }),
      null,
      config,
      NOW,
    );
    expect(lead.stage).toBe("perdido");
    expect(lead.lost).toEqual({
      at: daysAgo(1),
      reason: "inactivity",
      detail: "",
      reversible: true,
    });
    expect(lead.daysInactive).toBe(31);
  });

  it("flags por vencer with the days left when inside the warning window", () => {
    const lead = deriveLead(
      signals({ firstSeen: daysAgo(25), lastMessageAt: daysAgo(25) }),
      null,
      config,
      NOW,
    );
    expect(lead.stage).toBe("nuevo");
    expect(lead.atRisk).toEqual({ lostOn: daysAhead(5), daysLeft: 5 });
  });

  it("does not flag por vencer before the warning window", () => {
    const lead = deriveLead(signals({ lastMessageAt: daysAgo(20) }), null, config, NOW);
    expect(lead.atRisk).toBeNull();
  });

  it("restarts the clock with a logged activity (a call at day 20)", () => {
    const lead = deriveLead(
      signals({ lastMessageAt: daysAgo(40), lastCrmActivityAt: daysAgo(20) }),
      null,
      config,
      NOW,
    );
    expect(lead.stage).toBe("nuevo");
    expect(lead.lost).toBeNull();
    expect(lead.daysInactive).toBe(20);
  });

  it("revives an auto-lost lead when a person moves it (stage change is activity)", () => {
    const lead = deriveLead(
      signals({ lastMessageAt: daysAgo(45) }),
      state({ stage: "contactado", stageChangedAt: daysAgo(0) }),
      config,
      NOW,
    );
    expect(lead).toMatchObject({ stage: "contactado", source: "manual", lost: null });
  });

  it("revives an auto-lost lead when the contact writes again", () => {
    const lead = deriveLead(
      signals({ firstSeen: daysAgo(50), lastMessageAt: daysAgo(0), lastHandoffAt: daysAgo(49) }),
      null,
      config,
      NOW,
    );
    expect(lead).toMatchObject({ stage: "calificado", lost: null });
  });
});

describe("deriveLead — reminders and owner", () => {
  it("classifies overdue, upcoming, scheduled and done reminders", () => {
    const status = (s: Partial<LeadStateRow>) =>
      deriveLead(signals(), state(s), config, NOW).reminder?.status;
    expect(status({ nextActionAt: daysAgo(1) })).toBe("overdue");
    expect(status({ nextActionAt: daysAhead(3) })).toBe("upcoming");
    expect(status({ nextActionAt: daysAhead(15) })).toBe("scheduled");
    expect(status({ nextActionAt: daysAgo(1), nextActionDoneAt: daysAgo(0) })).toBe("done");
    expect(status({})).toBeUndefined();
  });

  it("does not count the owner assignment as activity", () => {
    const lead = deriveLead(
      signals({ lastMessageAt: daysAgo(31) }),
      state({ ownerEmail: "asesor@cliente.com", openedAt: daysAgo(40) }),
      config,
      NOW,
    );
    expect(lead.owner).toBe("asesor@cliente.com");
    expect(lead.stage).toBe("perdido");
  });
});

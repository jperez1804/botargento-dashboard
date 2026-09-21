import { describe, expect, it } from "vitest";
import { realEstate } from "@/config/verticals/real-estate";
import { parsePriority, priorityOptions, priorityRank, priorityView } from "@/lib/crm/priority";

const labels = realEstate.crm!.labels;

describe("priority", () => {
  it("parses persisted keys and rejects everything else", () => {
    expect(parsePriority("alta")).toBe("alta");
    expect(parsePriority(" MEDIA ")).toBe("media");
    expect(parsePriority("")).toBeNull();
    expect(parsePriority("urgente")).toBeNull();
    expect(parsePriority(null)).toBeNull();
    expect(parsePriority(3)).toBeNull();
  });

  it("ranks alta first and none last", () => {
    expect([null, "baja", "alta", "media"].map((k) => priorityRank(k as never))).toEqual([3, 2, 0, 1]);
  });

  it("builds the view from the vertical labels", () => {
    expect(priorityView("alta", labels)).toEqual({ key: "alta", label: "Alta", tone: "danger" });
    expect(priorityView(null, labels)).toBeNull();
    expect(priorityOptions(labels).map((p) => p.label)).toEqual(["Alta", "Media", "Baja"]);
  });
});

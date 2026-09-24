import { describe, expect, it } from "vitest";
import { rememberedLeadsQuery } from "@/lib/crm/filter-memory";

const q = (s: string) => new URLSearchParams(s);

describe("rememberedLeadsQuery", () => {
  it("keeps the filter keys and the board/list view, never the search or the page", () => {
    expect(rememberedLeadsQuery(q("view=list&stage=visita&mine=1&priority=alta&q=ana&page=3"))).toBe(
      "view=list&stage=visita&mine=1&priority=alta",
    );
    expect(rememberedLeadsQuery(q("filter=overdue&open=perdido&intent=Alquileres"))).toBe(
      "filter=overdue&intent=Alquileres&open=perdido",
    );
  });

  it("is empty for an unfiltered board and null for the views without filters", () => {
    expect(rememberedLeadsQuery(q(""))).toBe("");
    expect(rememberedLeadsQuery(q("q=ana"))).toBe("");
    expect(rememberedLeadsQuery(q("view=summary"))).toBeNull();
    expect(rememberedLeadsQuery(q("view=guide&stage=visita"))).toBeNull();
  });
});

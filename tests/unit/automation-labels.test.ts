import { describe, expect, it } from "vitest";
import { formatAutomationLabel, normalizeAutomationToken } from "@/lib/automation-labels";

describe("normalizeAutomationToken", () => {
  it("normalizes case, spaces, and dashes", () => {
    expect(normalizeAutomationToken(" Sales Lead ")).toBe("sales_lead");
    expect(normalizeAutomationToken("rental-lead")).toBe("rental_lead");
    expect(normalizeAutomationToken("owners advisor")).toBe("owners_advisor");
  });
});

describe("formatAutomationLabel", () => {
  it("formats known lead reasons", () => {
    expect(formatAutomationLabel("sales_lead")).toBe("Consulta por compra");
    expect(formatAutomationLabel("rental_lead")).toBe("Consulta por alquiler");
    expect(formatAutomationLabel("owners_advisor")).toBe("Consulta de propietario");
  });

  it("formats known handoff target labels case-insensitively", () => {
    expect(formatAutomationLabel("Owners")).toBe("Propietarios");
    expect(formatAutomationLabel("valuations")).toBe("Tasaciones");
    expect(formatAutomationLabel("UNSPECIFIED")).toBe("Sin especificar");
    expect(formatAutomationLabel("Rents")).toBe("Alquileres");
    expect(formatAutomationLabel("Sales")).toBe("Ventas");
  });

  it("supports separator variants", () => {
    expect(formatAutomationLabel("sales lead")).toBe("Consulta por compra");
    expect(formatAutomationLabel("rental-lead")).toBe("Consulta por alquiler");
    expect(formatAutomationLabel("owners advisor")).toBe("Consulta de propietario");
  });

  it("keeps unknown values safe and unchanged apart from trimming", () => {
    expect(formatAutomationLabel(" custom_token ")).toBe("custom_token");
  });

  it("returns null for empty values", () => {
    expect(formatAutomationLabel(null)).toBeNull();
    expect(formatAutomationLabel(undefined)).toBeNull();
    expect(formatAutomationLabel("   ")).toBeNull();
  });
});

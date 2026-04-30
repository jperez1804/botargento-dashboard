import { describe, expect, it } from "vitest";
import {
  formatAutomationLabel,
  formatBusinessIntentLabel,
  normalizeAutomationToken,
} from "@/lib/automation-labels";

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

  it("formats guided post-results workflow reasons", () => {
    expect(formatAutomationLabel("guided_sales_post_results_advisor")).toBe(
      "Consulta por compra",
    );
    expect(formatAutomationLabel("guided_sales_post_results_visit")).toBe("Consulta por compra");
    expect(formatAutomationLabel("guided_rents_post_results_advisor")).toBe(
      "Consulta por alquiler",
    );
    expect(formatAutomationLabel("guided_rents_post_results_visit")).toBe(
      "Consulta por alquiler",
    );
    expect(formatAutomationLabel("otras_handoff")).toBe("Otras consultas");
  });

  it("formats short post-results aliases shown in seguimiento", () => {
    expect(formatAutomationLabel("post_results_advisor")).toBe("Consulta por compra");
    expect(formatAutomationLabel("post_results_visit")).toBe("Consulta por compra");
  });

  it("formats known handoff target labels case-insensitively", () => {
    expect(formatAutomationLabel("Owners")).toBe("Propietarios");
    expect(formatAutomationLabel("owners_lead")).toBe("Propietarios");
    expect(formatAutomationLabel("valuations")).toBe("Tasaciones");
    expect(formatAutomationLabel("UNSPECIFIED")).toBe("Sin especificar");
    expect(formatAutomationLabel("Rents")).toBe("Alquileres");
    expect(formatAutomationLabel("Sales")).toBe("Ventas");
    expect(formatAutomationLabel("emprendimientos_lead")).toBe("Emprendimientos");
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

describe("formatBusinessIntentLabel", () => {
  it("formats known flow intents into client-friendly buckets", () => {
    expect(formatBusinessIntentLabel("sales_lead")).toBe("Consulta por compra");
    expect(formatBusinessIntentLabel("guided_sales_post_results_visit")).toBe(
      "Consulta por compra",
    );
    expect(formatBusinessIntentLabel("post_results_advisor")).toBe("Consulta por compra");
    expect(formatBusinessIntentLabel("rental_lead")).toBe("Consulta por alquiler");
    expect(formatBusinessIntentLabel("guided_rents_post_results_advisor")).toBe(
      "Consulta por alquiler",
    );
  });

  it("keeps configured business buckets visible", () => {
    expect(formatBusinessIntentLabel("emprendimientos")).toBe("Emprendimientos");
    expect(formatBusinessIntentLabel("owners_lead")).toBe("Propietarios");
    expect(formatBusinessIntentLabel("tasaciones")).toBe("Tasaciones");
    expect(formatBusinessIntentLabel("otras")).toBe("Otras");
  });

  it("excludes menu and groups unknowns under Otras", () => {
    expect(formatBusinessIntentLabel("menu")).toBeNull();
    expect(formatBusinessIntentLabel(" custom_token ")).toBe("Otras");
  });
});

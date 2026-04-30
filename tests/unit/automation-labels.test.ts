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
  it("folds Ventas-family raw tokens into the configured Ventas bucket", () => {
    expect(formatBusinessIntentLabel("sales_lead")).toBe("Ventas");
    expect(formatBusinessIntentLabel("sales")).toBe("Ventas");
    expect(formatBusinessIntentLabel("guided_sales_post_results_visit")).toBe("Ventas");
    expect(formatBusinessIntentLabel("guided_sales_post_results_advisor")).toBe("Ventas");
    expect(formatBusinessIntentLabel("post_results_advisor")).toBe("Ventas");
    expect(formatBusinessIntentLabel("post_results_visit")).toBe("Ventas");
  });

  it("folds Alquileres-family raw tokens into the configured Alquileres bucket", () => {
    expect(formatBusinessIntentLabel("rental_lead")).toBe("Alquileres");
    expect(formatBusinessIntentLabel("rents")).toBe("Alquileres");
    expect(formatBusinessIntentLabel("guided_rents_post_results_advisor")).toBe("Alquileres");
    expect(formatBusinessIntentLabel("guided_rents_post_results_visit")).toBe("Alquileres");
  });

  it("folds owners-family raw tokens into the configured Administracion bucket", () => {
    // The "Administración / Propietarios" menu option lives in the same bucket
    // for chart aggregation; "Propietarios" remains the friendly term in tables.
    expect(formatBusinessIntentLabel("owners")).toBe("Administracion");
    expect(formatBusinessIntentLabel("owners_lead")).toBe("Administracion");
    expect(formatBusinessIntentLabel("owners_advisor")).toBe("Administracion");
  });

  it("keeps configured business buckets visible", () => {
    expect(formatBusinessIntentLabel("ventas")).toBe("Ventas");
    expect(formatBusinessIntentLabel("alquileres")).toBe("Alquileres");
    expect(formatBusinessIntentLabel("emprendimientos")).toBe("Emprendimientos");
    expect(formatBusinessIntentLabel("emprendimientos_lead")).toBe("Emprendimientos");
    expect(formatBusinessIntentLabel("tasaciones")).toBe("Tasaciones");
    expect(formatBusinessIntentLabel("valuations")).toBe("Tasaciones");
    expect(formatBusinessIntentLabel("otras")).toBe("Otras");
    expect(formatBusinessIntentLabel("otras_handoff")).toBe("Otras");
  });

  it("excludes menu and groups unknowns under Otras", () => {
    expect(formatBusinessIntentLabel("menu")).toBeNull();
    expect(formatBusinessIntentLabel(" custom_token ")).toBe("Otras");
  });

  it("does not affect formatAutomationLabel display strings", () => {
    // formatAutomationLabel must keep showing operator-friendly text in tables
    // and follow-up reasons even though the chart bucket differs.
    expect(formatAutomationLabel("owners_advisor")).toBe("Consulta de propietario");
    expect(formatAutomationLabel("owners")).toBe("Propietarios");
    expect(formatAutomationLabel("sales_lead")).toBe("Consulta por compra");
  });
});

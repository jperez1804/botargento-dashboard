import type { VerticalConfig } from "./_types";

export const realEstate: VerticalConfig = {
  key: "real-estate",
  label: "Inmobiliarias",

  nav: [
    { href: "/", label: "Panel", icon: "dashboard" },
    { href: "/conversations", label: "Conversaciones", icon: "conversations" },
    { href: "/handoffs", label: "Derivaciones", icon: "handoffs" },
    { href: "/follow-up", label: "Seguimiento", icon: "follow-up" },
  ],

  kpis: [
    { id: "inbound", label: "Mensajes entrantes", format: "number", higherIsBetter: true },
    { id: "outbound", label: "Mensajes salientes", format: "number", higherIsBetter: true },
    { id: "unique_contacts", label: "Contactos únicos", format: "number", higherIsBetter: true },
    { id: "handoff_rate", label: "Tasa de derivación", format: "percent", higherIsBetter: false },
  ],

  intents: [
    {
      key: "Ventas",
      label: "Ventas",
      color: "#3b82f6",
      desiredHandoffRate: 0.8,
      terminalIntents: [
        "guided_sales_post_results_advisor",
        "guided_sales_post_results_visit",
        "post_results_advisor",
        "post_results_visit",
      ],
    },
    {
      key: "Alquileres",
      label: "Alquileres",
      color: "#10b981",
      desiredHandoffRate: 0.8,
      terminalIntents: [
        "guided_rents_post_results_advisor",
        "guided_rents_post_results_visit",
      ],
    },
    {
      key: "Tasaciones",
      label: "Tasaciones",
      color: "#f59e0b",
      desiredHandoffRate: 0.95,
      terminalIntents: ["tasaciones_handoff"],
    },
    {
      key: "Emprendimientos",
      label: "Emprendimientos",
      color: "#8b5cf6",
      desiredHandoffRate: 0.2,
      terminalIntents: ["emprendimientos_handoff"],
    },
    {
      key: "Administracion",
      label: "Administración",
      color: "#6b7280",
      desiredHandoffRate: 0.9,
      terminalIntents: ["owners_handoff"],
    },
    {
      key: "Otras",
      label: "Otras",
      color: "#94a3b8",
      desiredHandoffRate: 0.7,
      terminalIntents: ["otras_handoff"],
    },
  ],

  handoffTargets: [
    { match: "ventas", label: "Equipo de Ventas" },
    { match: "alquileres", label: "Equipo de Alquileres" },
    { match: "admin", label: "Administración" },
  ],

  attribution: {
    controlLabel: "Cómo contar contactos",
    controlTooltip:
      "Si una persona consulta por varias cosas, elegimos cómo asignarla a una categoría. Por defecto usamos su último interés porque muestra dónde terminó la conversación.",
    scopeNote:
      "Cambia Contactos por intención, Intención líder y métricas por contacto. No cambia el volumen de mensajes ni los KPIs globales.",
    advancedToggleLabel: "Análisis avanzado",
    options: [
      {
        value: "last",
        label: "Último interés",
        helper: "Cuenta al contacto donde terminó su conversación.",
      },
      {
        value: "first",
        label: "Interés inicial",
        helper: "Cuenta al contacto por lo primero que consultó.",
        advanced: true,
      },
      {
        value: "any",
        label: "Todas las consultas",
        helper: "Puede contar una misma persona en más de una categoría.",
        advanced: true,
      },
    ],
    anyModeWarning: "Una misma persona puede aparecer en más de una categoría.",
    leadingIntentCaptionTemplate: "Según: {label}",
    handoffDisclaimerShort: "Derivación calculada por último interés.",
    handoffDisclaimerDetail:
      "Cada contacto aparece en una sola fila. La suma de tasas no equivale a la tasa global de derivación: contactos cuya última actividad fue navegación del menú quedan fuera de estas filas pero cuentan en la tasa global, y el promedio de proporciones por bucket no coincide con el cociente total.",
    engagementDensityNote:
      "El volumen no cambia con esta vista; el promedio usa los contactos de la vista seleccionada.",
  },
};

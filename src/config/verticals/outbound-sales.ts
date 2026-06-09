import type { VerticalConfig } from "./_types";

// Outbound sales (Bot Argento Ventas). The inbound reply side lands in
// automation.* like any tenant, so the standard pages work from this config;
// the outbound funnel lives in outreach.* and is surfaced via features.campaignsTab.
export const outboundSales: VerticalConfig = {
  key: "outbound-sales",
  label: "Ventas",

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
      key: "ventas_lead",
      label: "Lead de ventas",
      desiredHandoffRate: 0.7,
      terminalIntents: ["guided_ventas_handoff"],
    },
  ],

  handoffTargets: [{ match: "ventas", label: "Ventas / Demo", priority: 1 }],

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
      "Cada contacto aparece en una sola fila. La suma de tasas no equivale a la tasa global de derivación.",
    engagementDensityNote:
      "El volumen no cambia con esta vista; el promedio usa los contactos de la vista seleccionada.",
  },

  windows: {
    controlLabel: "Período",
    scopeNote:
      "La heatmap de demanda y la cola de seguimiento usan ventanas propias.",
    options: [
      { value: 7, label: "7 días" },
      { value: 14, label: "14 días" },
      { value: 28, label: "28 días" },
      { value: 56, label: "56 días" },
    ],
    comparisonTemplate: "Comparado con los {N} días anteriores.",
  },

  features: {
    campaignsTab: true,
  },
};

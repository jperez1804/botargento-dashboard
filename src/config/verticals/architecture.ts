import type { VerticalConfig } from "./_types";

export const architecture: VerticalConfig = {
  key: "architecture",
  label: "Arquitectura",

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
      key: "proyecto_lead",
      label: "Proyecto",
      color: "#3b82f6",
      desiredHandoffRate: 0.7,
      terminalIntents: ["guided_proyecto_handoff"],
    },
    {
      key: "construccion_lead",
      label: "Construcción",
      color: "#f97316",
      desiredHandoffRate: 0.7,
      terminalIntents: [
        "guided_construccion_sales_handoff",
        "guided_construccion_technical_handoff",
      ],
    },
    {
      key: "gestiones_lead",
      label: "Gestiones",
      color: "#10b981",
      desiredHandoffRate: 0.85,
      terminalIntents: ["guided_gestiones_handoff"],
    },
    {
      key: "desarrollo_lead",
      label: "Desarrollos",
      color: "#8b5cf6",
      desiredHandoffRate: 0.7,
      terminalIntents: [
        "guided_desarrollo_invertir_handoff",
        "guided_desarrollo_zona_handoff",
        "guided_desarrollo_desarrollar_handoff",
        "guided_desarrollo_asociarse_handoff",
        "guided_desarrollo_comprar_handoff",
        "guided_desarrollo_comprar_no_inventory",
      ],
    },
    {
      key: "proveedor_intake",
      label: "Proveedores",
      color: "#0ea5e9",
      desiredHandoffRate: 0.3,
      terminalIntents: [
        "guided_proveedores_register_handoff",
        "guided_proveedores_lookup_handoff",
      ],
    },
    {
      key: "mano_obra_intake",
      label: "Mano de obra",
      color: "#6b7280",
      desiredHandoffRate: 0.3,
      terminalIntents: ["guided_mano_obra_handoff"],
    },
  ],

  handoffTargets: [
    { match: "architect", label: "Arquitectura" },
    { match: "sales", label: "Comercial" },
    { match: "technical", label: "Técnico" },
    { match: "municipal", label: "Gestión municipal" },
    { match: "development", label: "Desarrollos" },
    { match: "purchasing", label: "Compras" },
    { match: "hr", label: "RRHH / Obra" },
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
};

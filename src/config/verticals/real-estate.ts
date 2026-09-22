import type { VerticalConfig } from "./_types";
import { CRM_LABELS_ES } from "./_crm-labels-es";

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
    // Capability only — the /inbox tab activates per tenant via N8N_INBOX_WEBHOOK_URL/
    // TOKEN in dashboard.env (currently only client1 has the n8n inbox webhook).
    inboxTab: true,
    crmTab: true,
  },

  // CRM-lite pipeline. The bot moves leads through nuevo → contactado →
  // calificado (handoff) and into perdido (opt-out / inactivity); visita,
  // reserva and cerrado are set by a person. Keys are persisted — don't rename.
  crm: {
    stages: [
      {
        key: "nuevo",
        label: "Nuevo",
        tone: "neutral",
        help: "Escribió o fue cargado a mano y todavía nadie del equipo habló con la persona.",
      },
      {
        key: "contactado",
        label: "Contactado",
        tone: "info",
        help: "Alguien del equipo ya le respondió. Si lo llamaste o le escribiste desde tu teléfono, movelo a mano.",
      },
      {
        key: "calificado",
        label: "Calificado",
        tone: "info",
        help: "El bot captó zona, tipo de propiedad y presupuesto, y derivó la consulta al equipo.",
      },
      {
        key: "visita",
        label: "Visita",
        tone: "progress",
        manualOnly: true,
        help: "Hay una visita coordinada o ya hecha.",
      },
      {
        key: "reserva",
        label: "Reserva",
        tone: "progress",
        manualOnly: true,
        help: "Dejó una reserva o una seña.",
      },
      {
        key: "cerrado",
        label: "Cerrado",
        tone: "good",
        manualOnly: true,
        terminal: true,
        help: "Operación concretada. Etapa final: no vence por inactividad.",
      },
      {
        key: "perdido",
        label: "Perdido",
        tone: "bad",
        terminal: true,
        help: "No sigue: por baja, inactividad o decisión del asesor. Cualquier actividad nueva lo reabre.",
      },
    ],
    autoStages: { new: "nuevo", contacted: "contactado", qualified: "calificado", lost: "perdido" },
    autoLostDays: 30,
    warnDays: 7,
    currencies: ["USD", "ARS"],
    qualificationFields: [
      { source: "snapshot", key: "selected_flow", label: "Consulta por" },
      { source: "escalation", key: "target_zone", label: "Zona" },
      { source: "escalation", key: "property_type", label: "Tipo de propiedad" },
      { source: "escalation", key: "bedrooms", label: "Ambientes" },
      {
        source: "escalation",
        key: "budget_amount",
        label: "Presupuesto",
        format: "money",
        currencyKey: "budget_currency",
      },
      { source: "snapshot", key: "selected_price_range", label: "Rango de precio" },
      { source: "escalation", key: "payment_mode", label: "Forma de pago" },
      { source: "escalation", key: "purchase_timing", label: "Plazo" },
      { source: "snapshot", key: "tasaciones_address", label: "Dirección a tasar" },
      { source: "snapshot", key: "tasaciones_property_type", label: "Propiedad a tasar" },
      { source: "snapshot", key: "tasaciones_area", label: "Superficie" },
      { source: "snapshot", key: "tasaciones_condition", label: "Estado" },
      { source: "snapshot", key: "tasaciones_reason", label: "Motivo de la tasación" },
      { source: "snapshot", key: "owners_service_type", label: "Servicio (propietario)" },
      { source: "snapshot", key: "owners_zone", label: "Zona (propietario)" },
      { source: "escalation", key: "preferred_contact_slot", label: "Horario de contacto" },
      { source: "escalation", key: "matched_listing_urls", label: "Propiedades sugeridas", format: "links" },
      { source: "escalation", key: "transcript_summary", label: "Resumen del bot" },
    ],
    // Leads that did not come through WhatsApp (registered from /leads).
    // Keys are persisted in dashboard.manual_leads — don't rename.
    manualLeadSources: [
      { key: "telefono", label: "Teléfono" },
      { key: "visita", label: "Visita a la oficina" },
      { key: "portal", label: "Portal inmobiliario" },
      { key: "referido", label: "Referido" },
      { key: "otro", label: "Otro" },
    ],
    labels: CRM_LABELS_ES,
  },
};

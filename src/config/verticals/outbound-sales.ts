import type { VerticalConfig } from "./_types";
import { CRM_LABELS_ES } from "./_crm-labels-es";

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
    // A handoff (demo) is the goal here, so "Resueltas por el bot" reads backwards
    // — hide it on the Panel.
    botResolutionKpi: false,
    // Capability only — the tab activates per tenant via N8N_INBOX_WEBHOOK_URL/
    // TOKEN in dashboard.env (currently only the ventas tenant has the n8n
    // inbox webhook deployed).
    inboxTab: true,
    // Capability only — the tenant turns it on with CRM_ENABLED in dashboard.env.
    // Three tenants run this vertical (ventas, tasty, arka) and only ventas
    // bought the CRM; without the tenant key the shared image would light it
    // up on all three.
    crmTab: true,
  },

  // CRM-lite for OUTBOUND sales (docs/crm-oportunidades.md, "Reglas por
  // vertical"). We write first, so the rules differ from real-estate in four
  // places: a REPLY opens the opportunity (the campaign already chose the
  // person), the rubro is the PROSPECT's business (not the handoff's flavour —
  // every outbound handoff is "wants a demo"), the pipeline is a sales one,
  // and a cold prospect goes stale in 14 days, not 30. Keys are persisted —
  // don't rename.
  crm: {
    opener: "reply",
    kinds: [
      { key: "inmobiliaria", label: "Inmobiliaria" },
      { key: "arquitectura", label: "Arquitectura" },
      { key: "otro", label: "Otro" },
    ],
    // outreach.recipients.vertical → rubro. The campaigns use both spellings.
    kindFromCampaign: { inmobiliaria: "inmobiliaria", architecture: "arquitectura", arquitectura: "arquitectura" },
    stages: [
      {
        key: "nuevo",
        label: "Nuevo",
        tone: "neutral",
        help: "Respondió a la campaña. Todavía nadie del equipo habló con la persona.",
      },
      {
        key: "calificado",
        label: "Calificado",
        tone: "info",
        help: "Pidió la demo, preguntó el precio o hizo una pregunta concreta: el bot derivó.",
      },
      {
        key: "demo",
        label: "Demo",
        tone: "progress",
        manualOnly: true,
        help: "Demo agendada o hecha.",
      },
      {
        key: "propuesta",
        label: "Propuesta",
        tone: "progress",
        manualOnly: true,
        help: "Se le mandó una propuesta o un número.",
      },
      {
        key: "cerrado",
        label: "Cerrado",
        tone: "good",
        manualOnly: true,
        terminal: true,
        help: "Cliente. Etapa final: no vence por inactividad.",
      },
      {
        key: "perdido",
        label: "Perdido",
        tone: "bad",
        terminal: true,
        help: "No sigue: por baja, inactividad o decisión tuya. Cualquier actividad nueva lo reabre.",
      },
    ],
    autoStages: { new: "nuevo", qualified: "calificado", lost: "perdido" },
    // A cold prospect who answered once and went quiet for two weeks is gone.
    autoLostDays: 14,
    warnDays: 3,
    currencies: ["ARS"],
    activityStages: { meeting: "demo" },
    qualificationFields: [
      { source: "campaign", key: "campaign_name", label: "Campaña", display: "chip" },
      {
        source: "snapshot",
        key: "rubro",
        label: "Rubro (según el wizard)",
        valueLabels: { inmobiliaria: "Inmobiliaria", arquitectura: "Arquitectura", otro: "Otro" },
      },
      {
        source: "snapshot",
        key: "hoy",
        label: "Cómo atiende hoy",
        valueLabels: { a_mano: "A mano", algo: "Tiene algo", no: "No las atiende" },
        display: "chip",
      },
      {
        source: "snapshot",
        key: "cta",
        label: "Qué pidió",
        valueLabels: { quiero: "El mes gratis", demo_panel: "La demo del panel" },
        display: "chip",
      },
      { source: "snapshot", key: "business_name", label: "Negocio" },
      { source: "campaign", key: "touch_count", label: "Envíos de la campaña" },
      { source: "escalation", key: "transcript_summary", label: "Resumen del bot", display: "summary" },
    ],
    // Somebody Jonatan met outside the campaigns.
    manualLeadSources: [
      { key: "referido", label: "Referido" },
      { key: "evento", label: "Evento" },
      { key: "otro", label: "Otro" },
    ],
    // The shared copy, with the parts that only make sense for a real-estate
    // agency (visits, balconies, "quien escribe al bot") rewritten for a sales
    // pipeline where we wrote first.
    labels: {
      ...CRM_LABELS_ES,
      reminderNotePlaceholder: "Ej.: mandarle la propuesta después de la demo",
      newLeadHint: "Para prospectos que no vinieron por una campaña: alguien que conociste en un evento o que te refirieron.",
      emptyFirstRun: "Todavía no hay oportunidades. Se abren solas cuando alguien responde a una campaña, o cargá una con «Nuevo lead».",
      activityPlaceholders: {
        note: "¿Qué pasó? Ej.: le interesa el tablero, lo ve con el socio",
        call: "¿Qué hablaron? Ej.: quiere la demo el jueves",
        visit: "¿Cómo fue? Ej.: pasé por la oficina, atienden a mano",
        meeting: "¿Qué se acordó en la demo? Ej.: arranca con el plan de 140",
      },
      lostReasons: ["Eligió otra herramienta", "Sin presupuesto", "No responde", "No le interesa", "Otro"],
      opportunity: {
        ...CRM_LABELS_ES.opportunity,
        dialogHint: "Para cuando la misma persona vuelve por otra cosa: una segunda campaña, otro negocio, otro momento.",
        titlePlaceholder: "Ej.: plan Atención + Audios para la sucursal de Palermo",
        underivedHint:
          "Respondieron antes de activar el tablero, o no llegaron a responder. Abrí una oportunidad si vale la pena trabajarlos.",
        underivedEmpty: "Todos los que respondieron tienen su oportunidad.",
      },
      guide: {
        ...CRM_LABELS_ES.guide,
        autoNew: "Cuando la persona responde a una campaña, o cuando se carga a mano.",
        autoQualified: "Cuando pide la demo, pregunta el precio o hace una pregunta concreta y el bot deriva.",
        sourcesBody:
          "Los prospectos que responden a una campaña llegan como Campaña. Los que escriben por su cuenta, como WhatsApp. Los que conociste en otro lado se cargan a mano.",
        opportunitiesIntro:
          "Una misma persona puede tener varias oportunidades en el tiempo: contestó una campaña en junio, no siguió, y vuelve en septiembre por otra. Cada una se sigue por separado.",
        opportunitiesHandoff:
          "Cuando alguien responde a una campaña se abre una oportunidad sola, en Nuevo, con el rubro de la campaña. Si pide la demo o el precio, pasa a Calificado.",
        opportunitiesMessages:
          "Un segundo mensaje no abre otra: cuenta para la que ya está abierta y la mantiene viva.",
        opportunitiesUnderived:
          "Quien respondió antes de que se activara el tablero no tiene oportunidad. Está en Conversaciones, bajo «Sin derivar», y se abre a un click.",
        opportunitiesKind:
          "El rubro lo pone la campaña que le escribió. Si la persona contestó otra cosa en el wizard, o si está mal, lo corregís desde la ficha.",
      },
    },
  },
};

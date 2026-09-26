import type { VerticalConfig } from "./_types";
import { CRM_LABELS_ES } from "./_crm-labels-es";

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

  // Priority tiers from docs/plec-arquitectos/handoff-priority.md
  // (Updated 2026-05-27 — see §5.4 changelog: architect/development/municipal
  // promoted to T1, technical/sales bundled at T2, T3 reserved as default
  // fallback.)
  handoffTargets: [
    { match: "architect", label: "Arquitectura", priority: 1 },
    { match: "development", label: "Desarrollos", priority: 1 },
    { match: "municipal", label: "Gestión municipal", priority: 1 },
    { match: "technical", label: "Técnico", priority: 2 },
    { match: "sales", label: "Comercial", priority: 2 },
    { match: "purchasing", label: "Compras", priority: 4 },
    { match: "hr", label: "RRHH / Obra", priority: 4 },
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
    providersTab: true,
    laborPoolTab: true,
    // Capability only — the tenant turns it on with CRM_ENABLED in dashboard.env.
    crmTab: true,
  },

  // CRM-lite for an architecture studio (docs/crm-oportunidades.md, "Reglas
  // por vertical"). Inbound, like real-estate: a handoff opens the opportunity.
  // Two differences: the rubros are STRICT — only the four commercial ones, so
  // supplier and job-seeker intakes (which have their own tabs) never land on
  // the board — and a project cycle is long, so a lead goes stale in 45 days,
  // not 30. Keys are persisted — don't rename.
  crm: {
    opener: "handoff",
    kinds: [
      { key: "proyecto_lead", label: "Proyecto" },
      { key: "construccion_lead", label: "Construcción" },
      { key: "gestiones_lead", label: "Gestiones" },
      { key: "desarrollo_lead", label: "Desarrollos" },
    ],
    stages: [
      {
        key: "nuevo",
        label: "Nuevo",
        tone: "neutral",
        help: "Llegó la consulta y todavía nadie del estudio habló con la persona.",
      },
      {
        key: "calificado",
        label: "Calificado",
        tone: "info",
        help: "El bot terminó la consulta y la derivó al equipo, con lo que contó la persona.",
      },
      {
        key: "reunion",
        label: "Reunión",
        tone: "progress",
        manualOnly: true,
        help: "Primera reunión o visita al terreno u obra, agendada o hecha.",
      },
      {
        key: "presupuesto",
        label: "Presupuesto",
        tone: "progress",
        manualOnly: true,
        help: "Se mandó la propuesta de honorarios o el presupuesto de obra.",
      },
      {
        key: "cerrado",
        label: "Cerrado",
        tone: "good",
        manualOnly: true,
        terminal: true,
        help: "Aceptó la propuesta: es cliente. Etapa final, no vence por inactividad.",
      },
      {
        key: "perdido",
        label: "Perdido",
        tone: "bad",
        terminal: true,
        help: "No sigue: por inactividad o decisión del equipo. Cualquier actividad nueva lo reabre.",
      },
    ],
    autoStages: { new: "nuevo", qualified: "calificado", lost: "perdido" },
    // A project is decided over weeks: a month of silence is not yet a no.
    autoLostDays: 45,
    warnDays: 10,
    currencies: ["USD", "ARS"],
    activityStages: { meeting: "reunion", visit: "reunion" },
    qualificationFields: [
      {
        source: "escalation",
        key: "handoff_target",
        label: "Equipo",
        valueLabels: {
          architect: "Arquitectura",
          municipal: "Gestión municipal",
          sales: "Comercial",
          technical: "Técnico",
          development: "Desarrollos",
        },
        display: "chip",
      },
      {
        source: "snapshot",
        key: "selected_flow",
        label: "Consulta",
        valueLabels: {
          proyecto: "Proyecto",
          construccion: "Construcción",
          gestiones: "Gestiones",
          desarrollo: "Desarrollos",
        },
      },
      { source: "snapshot", key: "terreno", label: "Tiene terreno", valueLabels: { si: "Sí", no: "No", no_se: "No sabe" } },
      { source: "snapshot", key: "zona", label: "Zona" },
      { source: "snapshot", key: "zone", label: "Zona" },
      {
        source: "snapshot",
        key: "m2",
        label: "Superficie",
        valueLabels: { menos_100: "Menos de 100 m²", "100_400": "100 - 400 m²", mas_400: "Más de 400 m²" },
        display: "chip",
      },
      { source: "snapshot", key: "planos", label: "Tiene planos", valueLabels: { si: "Sí", no: "No", no_se: "No sabe" } },
      {
        source: "snapshot",
        key: "modalidad",
        label: "Qué necesita",
        valueLabels: { construir: "Construir", direccion: "Dirección de obra", cotizar: "Reforma" },
      },
      {
        source: "snapshot",
        key: "tramite",
        label: "Trámite",
        valueLabels: {
          permiso_obra: "Permiso de obra",
          regularizacion: "Regularización",
          consulta_general: "Consulta general",
        },
        display: "chip",
      },
      { source: "snapshot", key: "municipio", label: "Municipio" },
      {
        source: "snapshot",
        key: "subintencion",
        label: "Desarrollo",
        valueLabels: {
          invertir: "Invertir en pozo",
          desarrollar: "Desarrollar un terreno",
          asociarse: "Asociarse para un desarrollo",
        },
      },
      {
        source: "snapshot",
        key: "tipo_aporte",
        label: "Aporta",
        valueLabels: { terreno: "Terreno", capital: "Capital", ambos: "Terreno + capital" },
      },
      { source: "snapshot", key: "superficie", label: "Superficie del terreno" },
      { source: "snapshot", key: "estado_dominial", label: "Estado dominial" },
      { source: "snapshot", key: "descripcion", label: "Descripción" },
      { source: "escalation", key: "transcript_summary", label: "Resumen del bot", display: "summary" },
    ],
    manualLeadSources: [
      { key: "telefono", label: "Teléfono" },
      { key: "email", label: "Email" },
      { key: "instagram", label: "Instagram" },
      { key: "referido", label: "Referido" },
      { key: "otro", label: "Otro" },
    ],
    // The shared copy, with the parts written for a real-estate agency
    // (visits to a PH, balconies, reservations, "un alquiler y una venta")
    // rewritten for a studio.
    labels: {
      ...CRM_LABELS_ES,
      reminderNotePlaceholder: "Ej.: llamar para coordinar la visita al terreno",
      activityPlaceholders: {
        note: "¿Qué pasó? Ej.: mandó fotos del terreno y la medianera",
        call: "¿Qué hablaron? Ej.: quiere arrancar el anteproyecto en octubre",
        visit: "¿Cómo fue la visita? Ej.: terreno de 10×30, hay que regularizar lo existente",
        meeting: "¿Qué se acordó? Ej.: le mandamos la propuesta de honorarios el lunes",
      },
      lostReasons: ["Eligió otro estudio", "Fuera de presupuesto", "Postergó el proyecto", "No responde", "Otro"],
      newLeadHint:
        "Para consultas que no llegaron por WhatsApp: alguien que llamó, escribió por mail o Instagram, o vino referido.",
      opportunity: {
        ...CRM_LABELS_ES.opportunity,
        dialogHint:
          "Para cuando la misma persona consulta por otra cosa: un proyecto y una gestión municipal se siguen por separado.",
        titlePlaceholder: "Ej.: vivienda en Pilar, 180 m²",
      },
      guide: {
        ...CRM_LABELS_ES.guide,
        sourcesBody:
          "Las consultas que escriben al bot llegan por WhatsApp. Las que llaman, escriben por mail o Instagram, o vienen referidas se cargan a mano con «Nuevo lead»; si después escriben, la conversación se suma al mismo lead.",
        opportunitiesIntro:
          "Cada tarjeta del tablero es una oportunidad: una consulta concreta, con su rubro, su etapa y su responsable. La misma persona puede tener varias — un proyecto hoy y la gestión municipal de la obra más adelante — y cada una se sigue por separado. En la ficha del contacto están todas, numeradas por orden de apertura.",
        opportunitiesKind:
          "El rubro lo pone el bot según la consulta que derivó: Proyecto, Construcción, Gestiones o Desarrollos. Los proveedores y la mano de obra no abren oportunidades: tienen sus propias pestañas. Si el rubro está mal, lo corregís desde la ficha.",
      },
    },
  },
};

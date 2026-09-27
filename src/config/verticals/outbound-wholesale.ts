import type { VerticalConfig } from "./_types";
import { CRM_LABELS_ES } from "./_crm-labels-es";
import { outboundSales } from "./outbound-sales";

// A supplier selling wholesale to shops through outbound campaigns (first
// tenant: Tasty Living Soils → growshops). Everything outside the CRM is the
// outbound-sales vertical as is — campaigns, their actions, the Panel — so the
// only difference is how the sales pipeline reads. Same "reply" opener as
// ventas (docs/crm-oportunidades.md, "Reglas por vertical"); what changes is
// the rubro: it is not the prospect's business (every recipient is a
// growshop) but where the customer is in the relationship — the first order
// ("pack de apertura") or a repeat one. Keys are persisted — don't rename.
export const outboundWholesale: VerticalConfig = {
  ...outboundSales,
  key: "outbound-wholesale",
  label: "Venta mayorista",

  crm: {
    opener: "reply",
    kinds: [
      { key: "pack_apertura", label: "Pack de apertura" },
      { key: "reposicion", label: "Reposición" },
    ],
    // Every campaign so far writes to growshops, and that is a first order.
    kindFromCampaign: { growshop: "pack_apertura" },
    // A shop that already bought and writes again is ordering more.
    kindAfterWon: "reposicion",
    stages: [
      {
        key: "nuevo",
        label: "Nuevo",
        tone: "neutral",
        help: "Respondió a la campaña. Todavía no eligió zona ni habló con el vendedor.",
      },
      {
        key: "calificado",
        label: "Calificado",
        tone: "info",
        help: "El bot le pasó el contacto al vendedor: eligió zona o escribió qué necesita.",
      },
      {
        key: "cotizado",
        label: "Cotizado",
        tone: "progress",
        manualOnly: true,
        help: "Se le armó el pedido y se le pasó el costo del envío.",
      },
      {
        key: "pedido",
        label: "Pedido",
        tone: "progress",
        manualOnly: true,
        help: "Confirmó y pagó. Falta entregar.",
      },
      {
        key: "cerrado",
        label: "Cerrado",
        tone: "good",
        manualOnly: true,
        terminal: true,
        help: "Pedido entregado. Si vuelve a escribir, se abre una Reposición.",
      },
      {
        key: "perdido",
        label: "Perdido",
        tone: "bad",
        terminal: true,
        help: "No sigue: por baja, inactividad o decisión del equipo. Cualquier actividad nueva lo reabre.",
      },
    ],
    autoStages: { new: "nuevo", qualified: "calificado", lost: "perdido" },
    // A shop decides in days, not weeks.
    autoLostDays: 21,
    warnDays: 5,
    currencies: ["ARS"],
    qualificationFields: [
      { source: "campaign", key: "campaign_name", label: "Campaña", display: "chip" },
      {
        source: "snapshot",
        key: "zona",
        label: "Zona",
        valueLabels: { caba_gba: "CABA o GBA", interior: "Interior" },
        display: "chip",
      },
      { source: "snapshot", key: "ficha", label: "Pidió la ficha técnica", valueLabels: { true: "Sí" } },
      {
        source: "snapshot",
        key: "interes",
        label: "Le interesa",
        valueLabels: { sustratos: "Sustratos", fertilizantes: "Fertilizantes", macetas: "Macetas geotextiles" },
      },
      { source: "snapshot", key: "business_name", label: "Negocio" },
      { source: "campaign", key: "touch_count", label: "Envíos de la campaña" },
      { source: "escalation", key: "transcript_summary", label: "Resumen del bot", display: "summary" },
    ],
    manualLeadSources: [
      { key: "instagram", label: "Instagram" },
      { key: "tienda", label: "Tienda online" },
      { key: "referido", label: "Referido" },
      { key: "feria", label: "Feria / evento" },
      { key: "otro", label: "Otro" },
    ],
    labels: {
      ...CRM_LABELS_ES,
      reminderNotePlaceholder: "Ej.: preguntarle si ya recibió el pedido",
      newLeadHint:
        "Para comercios que no vinieron por una campaña: te escribieron por Instagram, compraron en la tienda online o los conociste en una feria.",
      emptyFirstRun:
        "Todavía no hay oportunidades. Se abren solas cuando un comercio responde a una campaña, o cargá una con «Nuevo lead».",
      activityPlaceholders: {
        note: "¿Qué pasó? Ej.: le mandé la lista mayorista",
        call: "¿Qué hablaron? Ej.: pide cotizar el envío a Rosario",
        visit: "¿Cómo fue? Ej.: pasé por el local, tienen poco stock de sustrato",
        meeting: "¿Qué se acordó? Ej.: arranca con el pack y en un mes repone",
      },
      lostReasons: [
        "Ya trabaja con otro proveedor",
        "Sin presupuesto",
        "El envío no le cierra",
        "No responde",
        "Otro",
      ],
      columnBudget: "Pedido",
      eventKinds: { ...CRM_LABELS_ES.eventKinds, budget: "Monto del pedido" },
      budget: {
        ...CRM_LABELS_ES.budget,
        label: "Monto del pedido",
        none: "Sin monto",
        amountPlaceholder: "Ej.: 126000",
        clearHint: "Quita el monto cargado.",
      },
      opportunity: {
        ...CRM_LABELS_ES.opportunity,
        dialogHint:
          "Para cuando el mismo comercio vuelve a comprar: cada pedido se sigue por separado. Si el anterior está Cerrado, la Reposición se abre sola cuando escribe.",
        titlePlaceholder: "Ej.: pack de apertura + 2 bolsas de sustrato",
        underivedHint:
          "Respondieron antes de activar el tablero. Abrí una oportunidad si vale la pena retomarlos.",
        underivedEmpty: "Todos los que respondieron tienen su oportunidad.",
      },
      guide: {
        ...CRM_LABELS_ES.guide,
        autoNew: "Cuando el comercio responde a una campaña, o cuando se carga a mano.",
        autoQualified: "Cuando elige su zona o escribe qué necesita, y el bot le pasa el contacto al vendedor.",
        sourcesBody:
          "Los comercios que responden a una campaña llegan como Campaña. Los que escriben por su cuenta, como WhatsApp. Los que conociste en otro lado se cargan a mano.",
        opportunitiesIntro:
          "Cada tarjeta es un pedido en curso: el primero (Pack de apertura) o uno siguiente (Reposición). Un mismo comercio tiene su historia de pedidos en la ficha, numerados por orden.",
        opportunitiesHandoff:
          "Cuando un comercio responde a una campaña se abre una oportunidad sola, en Nuevo, como Pack de apertura. Cuando elige zona o escribe, pasa a Calificado.",
        opportunitiesMessages:
          "Un segundo mensaje no abre otra: cuenta para la que ya está abierta y la mantiene viva.",
        opportunitiesUnderived:
          "Quien respondió antes de que se activara el tablero no tiene oportunidad. Está en Conversaciones, bajo «Sin derivar», y se abre a un click.",
        opportunitiesKind:
          "El rubro dice en qué momento está el cliente. El primer pedido es Pack de apertura; si ya tiene un pedido Cerrado y vuelve a escribir, la nueva se abre sola como Reposición. Si está mal, lo corregís desde la ficha.",
      },
    },
  },
};

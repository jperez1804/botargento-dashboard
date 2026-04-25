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
    { key: "Ventas", label: "Ventas", color: "#3b82f6" },
    { key: "Alquileres", label: "Alquileres", color: "#10b981" },
    { key: "Tasaciones", label: "Tasaciones", color: "#f59e0b" },
    { key: "Emprendimientos", label: "Emprendimientos", color: "#8b5cf6" },
    { key: "Administracion", label: "Administración", color: "#6b7280" },
    { key: "Otras", label: "Otras", color: "#94a3b8" },
  ],

  handoffTargets: [
    { match: "ventas", label: "Equipo de Ventas" },
    { match: "alquileres", label: "Equipo de Alquileres" },
    { match: "admin", label: "Administración" },
  ],
};

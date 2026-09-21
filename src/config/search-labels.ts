// Copy for the global search (header field + /buscar). Not vertical-specific:
// it searches leads when the vertical has a CRM, conversations otherwise.
export const SEARCH_LABELS = {
  placeholder: "Buscar por nombre o teléfono",
  shortcutHint: "Atajo: /",
  kicker: "Búsqueda",
  title: "Resultados",
  resultsTemplate: "{n} resultados para “{q}”",
  resultsOneTemplate: "1 resultado para “{q}”",
  emptyTemplate: "No encontramos nada con “{q}”. Probá con parte del nombre o del teléfono.",
  promptEmpty: "Escribí un nombre o un teléfono para buscar.",
  columnContact: "Contacto",
  columnStage: "Etapa",
  columnLastActivity: "Última actividad",
  rowAriaPrefix: "Abrir",
} as const;

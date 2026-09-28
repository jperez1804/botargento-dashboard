// Copy for media in the conversation thread (photos, voice notes, PDFs a lead
// sent). Kept out of JSX like the CRM labels (_crm-labels-es.ts): the thread is
// the same for every vertical, so one shared es-AR set rather than a field on
// each vertical config. Override by spreading if a tenant ever needs to.

export type MediaKind = "image" | "audio" | "document" | "video";

export type MediaLabels = {
  photoAlt: string;
  /** "Descargar PDF · 294 KB" -> `${download} ${name} · ${size}` */
  download: string;
  documentNames: Record<string, string>;
  documentDefault: string;
  audioUnsupported: string;
  tooLarge: string;
  notRetrievable: string;
  /** The message was media, but no row exists: expired (retention) or before capture. */
  unavailable: Record<MediaKind, string>;
  videoNotStored: string;
  noText: string;
  /** Placeholders for the CSV transcript, where an image has no text. */
  transcript: Record<MediaKind, string>;
};

export const MEDIA_LABELS_ES: MediaLabels = {
  photoAlt: "Foto enviada por el contacto",
  download: "Descargar",
  documentNames: {
    "application/pdf": "PDF",
    "application/msword": "Word",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
    "application/vnd.ms-excel": "Excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  },
  documentDefault: "archivo",
  audioUnsupported: "Tu navegador no reproduce este audio.",
  tooLarge: "Archivo muy grande (más de 5 MB): no se guardó",
  notRetrievable: "No se pudo recuperar el archivo",
  unavailable: {
    image: "📷 Foto — ya no disponible",
    audio: "🎤 Nota de voz — ya no disponible",
    document: "📄 Archivo — ya no disponible",
    video: "🎬 Video — ya no disponible",
  },
  videoNotStored: "🎬 Video — no se guarda",
  noText: "(sin texto)",
  transcript: {
    image: "[foto]",
    audio: "[audio]",
    document: "[documento]",
    video: "[video]",
  },
};

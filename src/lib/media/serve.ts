// How a stored media asset is handed to the browser. Pure: no DB, no Next — so
// the rules below are pinned by unit tests without a database.
//
// The bytes are private photos, voice notes and PDFs sent by leads. Two rules
// follow from that and shape every header here:
//   1. Nothing is cached anywhere but the viewer's current request.
//   2. Only a short allowlist of types is ever rendered inline on the
//      dashboard's origin. Anything else -- including image/svg+xml and
//      text/html, which would execute -- is forced to download as a plain
//      binary. Meta classifies the file; we do not trust that classification
//      enough to let it pick a content type.

const INLINE_TYPES: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "application/pdf": "pdf",
};

export type ServeHeaders = {
  "Content-Type": string;
  "Content-Length": string;
  "Content-Disposition": string;
  "Cache-Control": string;
  "X-Content-Type-Options": string;
};

/** The path segment must be a positive integer id; anything else is a 400. */
export function parseMediaId(raw: string): number | null {
  if (!/^[1-9]\d{0,17}$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Normalise what the row says the type is: lower-case, parameters stripped
 * (`audio/ogg; codecs=opus` -> `audio/ogg`, which is what WhatsApp voice notes
 * carry).
 */
export function baseMimeType(mime: string): string {
  return mime.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function headersFor(opts: { id: number; mime: string; byteLength: number }): ServeHeaders {
  const base = baseMimeType(opts.mime);
  const ext = INLINE_TYPES[base];
  const inline = ext !== undefined;
  return {
    "Content-Type": inline ? base : "application/octet-stream",
    "Content-Length": String(opts.byteLength),
    "Content-Disposition": inline
      ? `inline; filename="media-${opts.id}.${ext}"`
      : `attachment; filename="media-${opts.id}.bin"`,
    // Private to this viewer's request. Not `public`, not `max-age`: a lead's
    // photo must not sit in a shared cache or on the studio's disk longer than
    // the tab that showed it.
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

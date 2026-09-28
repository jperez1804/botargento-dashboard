// Stored WhatsApp media (a lead's photo, voice note or PDF), captured by the
// tenant's n8n router into `automation.media_assets`. The dashboard only ever
// reads it (invariant 1).
//
// Two shapes on purpose:
//   - Lists and the timeline read the VIEW `automation.v_media_assets`, which
//     deliberately has no `content` column, so a page query can never drag
//     binaries across the wire.
//   - The bytes are fetched here, one row, by our BIGSERIAL id, only when the
//     bytes route is asked for them. This is the single place the dashboard
//     reads the base table.

import { sql } from "@/db/client";

export type MediaContent = {
  mimeType: string;
  /** postgres.js returns bytea as a Buffer (a Uint8Array subclass). */
  content: Uint8Array;
};

/**
 * The bytes of one asset, or null when there is nothing to serve: no such row,
 * or a row whose fetch failed (too_large, download_failed, store_failed...).
 * Such rows exist so the timeline can explain an empty bubble from the view's
 * `fetch_status`; for the bytes route they are the same as absent.
 */
export async function getMediaContent(id: number): Promise<MediaContent | null> {
  const rows = await sql<{ mime_type: string; content: Uint8Array | null }[]>`
    SELECT mime_type, content
    FROM automation.media_assets
    WHERE id = ${id} AND content IS NOT NULL
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || !row.content) return null;
  return { mimeType: String(row.mime_type ?? ""), content: row.content };
}

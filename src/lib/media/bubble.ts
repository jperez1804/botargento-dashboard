// What the thread shows for a message that was (or carried) media. Pure: takes
// the lead_log entry as the query returns it and decides between a photo, a
// player, a download link, or a one-line explanation of why there is nothing to
// show. The component only renders what this returns, so every branch is
// pinned by a unit test without a browser.
//
// Three sources of truth, in order:
//   1. media row with content  -> show it (by the row's kind, not the message's)
//   2. media row without content -> say why (the row's fetch_status)
//   3. no row but the message was media -> "ya no disponible" (retention swept
//      it, or it predates capture -- everything before 2026-09-27 on plec) or
//      "no se guarda" for a kind capture skips (video)

import type { LeadLogEntry } from "@/lib/queries/contacts";
import type { MediaKind, MediaLabels } from "@/config/media-labels";

export type MediaPresentation =
  | { kind: "none" }
  | { kind: "image"; src: string; alt: string }
  | { kind: "audio"; src: string; mimeType: string; fallback: string }
  | { kind: "document"; src: string; label: string }
  | { kind: "note"; text: string };

/** lead_log.message_type -> the kind of media it was, or null for text etc. */
export function mediaKindOfMessage(messageType: string): MediaKind | null {
  switch (messageType) {
    case "image":
      return "image";
    case "audio":
    case "audio_transcribed":
      return "audio";
    case "document":
      return "document";
    case "video":
      return "video";
    default:
      return null;
  }
}

const asKind = (s: string): MediaKind | null =>
  s === "image" || s === "audio" || s === "document" || s === "video" ? s : null;

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function mediaSrc(id: number): string {
  return `/api/media/${id}`;
}

export function presentMedia(entry: LeadLogEntry, labels: MediaLabels): MediaPresentation {
  // Only what the lead sent is captured; the bot's own replies are text.
  if (entry.direction !== "inbound") return { kind: "none" };

  const media = entry.media;
  if (media && media.hasContent && media.fetchStatus === "stored") {
    const src = mediaSrc(media.id);
    switch (asKind(media.kind)) {
      case "image":
        return { kind: "image", src, alt: labels.photoAlt };
      case "audio":
        return { kind: "audio", src, mimeType: media.mimeType, fallback: labels.audioUnsupported };
      case "document": {
        const name = labels.documentNames[media.mimeType.split(";")[0]?.trim().toLowerCase() ?? ""]
          ?? labels.documentDefault;
        const size = formatBytes(media.byteSize);
        return { kind: "document", src, label: `${labels.download} ${name}${size ? ` · ${size}` : ""}` };
      }
      default:
        // A stored kind the thread has no renderer for: offer the bytes anyway.
        return { kind: "document", src, label: `${labels.download} ${labels.documentDefault}` };
    }
  }

  if (media) {
    // The row is there precisely so we can say why the bubble is empty.
    return { kind: "note", text: media.fetchStatus === "too_large" ? labels.tooLarge : labels.notRetrievable };
  }

  const wasKind = mediaKindOfMessage(entry.messageType);
  if (wasKind === "video") return { kind: "note", text: labels.videoNotStored };
  if (wasKind) return { kind: "note", text: labels.unavailable[wasKind] };
  return { kind: "none" };
}

/**
 * The `text` column of the CSV transcript. A photo has no text, so the export
 * says what it was; a voice note keeps its transcript, prefixed. Nothing here
 * ever touches lead_log.text_body (2026-09-25 decision: that column carries
 * only what the lead actually said).
 */
export function transcriptText(entry: LeadLogEntry, labels: MediaLabels): string {
  const text = entry.messageText ?? "";
  if (entry.direction !== "inbound") return text;
  const kind = entry.media ? asKind(entry.media.kind) : mediaKindOfMessage(entry.messageType);
  if (!kind) return text;
  const tag = labels.transcript[kind];
  return text.trim() ? `${tag} ${text}` : tag;
}

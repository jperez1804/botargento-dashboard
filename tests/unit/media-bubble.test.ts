// What the thread shows for a media message, and what the CSV transcript says.
// Pure functions over the entry shape getConversation returns; no DB, no DOM.

import { describe, expect, it } from "vitest";
import { MEDIA_LABELS_ES as L } from "@/config/media-labels";
import { formatBytes, mediaKindOfMessage, presentMedia, transcriptText } from "@/lib/media/bubble";
import type { LeadLogEntry, MediaRef } from "@/lib/queries/contacts";

const entry = (over: Partial<LeadLogEntry> = {}): LeadLogEntry => ({
  id: 1,
  direction: "inbound",
  intent: null,
  route: "media_ack",
  messageText: "",
  createdAt: "2026-09-27T21:44:39.000Z",
  sentBy: "",
  messageType: "image",
  media: null,
  ...over,
});

const stored = (over: Partial<MediaRef> = {}): MediaRef => ({
  id: 6,
  kind: "image",
  mimeType: "image/jpeg",
  fetchStatus: "stored",
  hasContent: true,
  byteSize: 81139,
  ...over,
});

describe("mediaKindOfMessage", () => {
  it("maps lead_log.message_type, including the transcribed variant", () => {
    expect(mediaKindOfMessage("image")).toBe("image");
    expect(mediaKindOfMessage("audio")).toBe("audio");
    expect(mediaKindOfMessage("audio_transcribed")).toBe("audio");
    expect(mediaKindOfMessage("document")).toBe("document");
    expect(mediaKindOfMessage("video")).toBe("video");
    expect(mediaKindOfMessage("text")).toBeNull();
    expect(mediaKindOfMessage("interactive_button_reply")).toBeNull();
    expect(mediaKindOfMessage("")).toBeNull();
  });
});

describe("presentMedia", () => {
  it("a stored photo renders as an image pointing at the bytes route", () => {
    const p = presentMedia(entry({ media: stored() }), L);
    expect(p).toEqual({ kind: "image", src: "/api/media/6", alt: L.photoAlt });
  });

  it("a stored voice note renders as a player, with its transcript left to the text", () => {
    const p = presentMedia(
      entry({ messageType: "audio_transcribed", messageText: "Hola. Hola.", media: stored({ id: 7, kind: "audio", mimeType: "audio/ogg", byteSize: 5339 }) }),
      L,
    );
    expect(p).toEqual({ kind: "audio", src: "/api/media/7", mimeType: "audio/ogg", fallback: L.audioUnsupported });
  });

  it("a stored PDF is a download link naming the type and the size", () => {
    const p = presentMedia(
      entry({ messageType: "document", media: stored({ id: 8, kind: "document", mimeType: "application/pdf", byteSize: 301419 }) }),
      L,
    );
    expect(p).toEqual({ kind: "document", src: "/api/media/8", label: "Descargar PDF · 294 KB" });
  });

  it("an unknown document type still offers the bytes, as 'archivo'", () => {
    const p = presentMedia(
      entry({ messageType: "document", media: stored({ id: 9, kind: "document", mimeType: "application/octet-stream", byteSize: 10 }) }),
      L,
    );
    expect(p).toMatchObject({ kind: "document", label: "Descargar archivo · 10 B" });
  });

  it("the row's kind wins over the message type", () => {
    // What was captured is what can be shown.
    const p = presentMedia(entry({ messageType: "text", media: stored({ id: 6 }) }), L);
    expect(p).toMatchObject({ kind: "image" });
  });

  it("a row without bytes explains itself from fetch_status", () => {
    expect(presentMedia(entry({ media: stored({ hasContent: false, fetchStatus: "too_large" }) }), L))
      .toEqual({ kind: "note", text: L.tooLarge });
    for (const status of ["download_failed", "meta_failed", "read_failed", "store_failed", "unsupported"]) {
      expect(presentMedia(entry({ media: stored({ hasContent: false, fetchStatus: status }) }), L))
        .toEqual({ kind: "note", text: L.notRetrievable });
    }
  });

  it("'stored' without content is treated as not retrievable, never as an image", () => {
    // Defensive: the two flags disagree only if something upstream is wrong.
    expect(presentMedia(entry({ media: stored({ hasContent: false }) }), L)).toEqual({ kind: "note", text: L.notRetrievable });
  });

  it("a media message with no row is 'ya no disponible' (retention, or before capture)", () => {
    expect(presentMedia(entry({ messageType: "image" }), L)).toEqual({ kind: "note", text: L.unavailable.image });
    expect(presentMedia(entry({ messageType: "audio_transcribed", messageText: "Hola." }), L)).toEqual({ kind: "note", text: L.unavailable.audio });
    expect(presentMedia(entry({ messageType: "document" }), L)).toEqual({ kind: "note", text: L.unavailable.document });
  });

  it("video is never captured, and says so rather than 'ya no disponible'", () => {
    expect(presentMedia(entry({ messageType: "video" }), L)).toEqual({ kind: "note", text: L.videoNotStored });
  });

  it("text messages and every outbound bubble show nothing extra", () => {
    expect(presentMedia(entry({ messageType: "text", messageText: "hola" }), L)).toEqual({ kind: "none" });
    expect(presentMedia(entry({ direction: "outbound", messageType: "text", messageText: "Te leo" }), L)).toEqual({ kind: "none" });
    // Even if an outbound row somehow carried a media ref.
    expect(presentMedia(entry({ direction: "outbound", media: stored() }), L)).toEqual({ kind: "none" });
  });
});

describe("transcriptText (the CSV export)", () => {
  it("a photo becomes [foto], a PDF [documento]", () => {
    expect(transcriptText(entry({ media: stored() }), L)).toBe("[foto]");
    expect(transcriptText(entry({ messageType: "document", media: stored({ kind: "document" }) }), L)).toBe("[documento]");
  });
  it("a voice note keeps its transcript, prefixed", () => {
    expect(transcriptText(entry({ messageType: "audio_transcribed", messageText: "Hola. Hola." }), L)).toBe("[audio] Hola. Hola.");
  });
  it("a media message whose asset is gone is still tagged from message_type", () => {
    expect(transcriptText(entry({ messageType: "image", media: null }), L)).toBe("[foto]");
  });
  it("text and outbound rows are untouched", () => {
    expect(transcriptText(entry({ messageType: "text", messageText: "hola" }), L)).toBe("hola");
    expect(transcriptText(entry({ direction: "outbound", messageType: "text", messageText: "Te leo" }), L)).toBe("Te leo");
    expect(transcriptText(entry({ messageType: "text", messageText: null }), L)).toBe("");
  });
});

describe("formatBytes", () => {
  it("es-AR style: KB rounded, MB with a comma", () => {
    expect(formatBytes(0)).toBe("");
    expect(formatBytes(10)).toBe("10 B");
    expect(formatBytes(5339)).toBe("5 KB");
    expect(formatBytes(301419)).toBe("294 KB");
    expect(formatBytes(4_800_000)).toBe("4,6 MB");
  });
});

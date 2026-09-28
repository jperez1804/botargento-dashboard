// The body of one bubble in the thread: the media a lead sent (photo, voice
// note, PDF), then the text under it (a caption, or a voice note's transcript).
// Server component -- pure data -> markup, like ConversationTimeline itself.
//
// The bytes come from /api/media/[id], a session-guarded route with
// `Cache-Control: private, no-store`, which is why the photo is a plain <img>
// and not next/image: an optimizer would cache a lead's private photo on the
// server and serve it from there.

import { MEDIA_LABELS_ES } from "@/config/media-labels";
import { presentMedia } from "@/lib/media/bubble";
import type { LeadLogEntry } from "@/lib/queries/contacts";

export function MediaBubble({ entry }: { entry: LeadLogEntry }) {
  const media = presentMedia(entry, MEDIA_LABELS_ES);
  const text = entry.messageText?.trim() ? entry.messageText : null;

  return (
    <>
      {media.kind === "image" ? (
        <a href={media.src} target="_blank" rel="noopener noreferrer" className="block mb-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- private bytes, must not go through the image optimizer/cache */}
          <img
            src={media.src}
            alt={media.alt}
            loading="lazy"
            className="max-w-full max-h-[320px] rounded-md border border-[var(--rule)]"
          />
        </a>
      ) : null}
      {media.kind === "audio" ? (
        <audio controls preload="none" src={media.src} className="w-full min-w-[240px] mb-1.5">
          {media.fallback}
        </audio>
      ) : null}
      {media.kind === "document" ? (
        <a
          href={media.src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mb-1.5 underline underline-offset-2 decoration-[var(--rule-strong)] hover:decoration-[var(--ink)]"
        >
          <span aria-hidden="true">📄</span>
          {media.label}
        </a>
      ) : null}
      {media.kind === "note" ? (
        <span className="block text-[var(--soft-ink)] italic">{media.text}</span>
      ) : null}
      {text ? (
        <span className="block">{text}</span>
      ) : media.kind === "none" ? (
        <span className="text-[var(--soft-ink)] italic">{MEDIA_LABELS_ES.noText}</span>
      ) : null}
    </>
  );
}

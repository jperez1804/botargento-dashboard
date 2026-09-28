// Streams one stored media asset (a lead's photo, voice note or PDF) to the
// browser. The timeline's <img>/<audio>/<a> point here by our BIGSERIAL id;
// nothing about Meta's storage (its media ids, its lookaside URLs) is ever
// exposed.
//
// Auth: the proxy guard (src/proxy.ts) already keeps unauthenticated requests
// out of /api/media/*, and requireRoleApi("viewer") makes the rule explicit
// and answers 401 JSON rather than a redirect. Any allowlisted user is a
// viewer, so this is "logged in", not a role gate.
//
// Read-only: SQL lives in src/lib/queries/media.ts; the dashboard never writes
// automation.* (invariant 1). Not audited per request on purpose -- a timeline
// with twenty photos would write twenty rows per page view; exports stay the
// audited action.

import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/role-guard";
import { getMediaContent } from "@/lib/queries/media";
import { headersFor, parseMediaId } from "@/lib/media/serve";

type Params = { id: string };

export async function GET(
  _req: Request,
  ctx: { params: Promise<Params> },
): Promise<NextResponse> {
  const gate = await requireRoleApi("viewer");
  if (gate.response) return gate.response;

  const { id: raw } = await ctx.params;
  const id = parseMediaId(raw);
  if (id === null) {
    return NextResponse.json({ error: "invalid media id" }, { status: 400 });
  }

  const media = await getMediaContent(id);
  if (!media) {
    // Absent, or present with content NULL (fetch failed): the bubble explains
    // WHY from the view's fetch_status; this route only has bytes or nothing.
    return NextResponse.json({ error: "media not found" }, { status: 404 });
  }

  // Re-wrap so the body is a plain BufferSource whatever the driver's subclass.
  const bytes = new Uint8Array(media.content);
  return new NextResponse(bytes, {
    status: 200,
    headers: headersFor({ id, mime: media.mimeType, byteLength: bytes.byteLength }),
  });
}

// Transcript export endpoint. Returns the full conversation for a contact
// as CSV. The button in ContactSidebar links here with `download` so the
// browser saves to disk via Content-Disposition.
//
// Auth: piggybacks on the middleware-level guard for /api/* routes
// (same model as /api/export/conversations and /api/export/daily-metrics).
// Read-only — no mutation.

import { NextResponse } from "next/server";
import { getContact, getConversation } from "@/lib/queries/contacts";

type Params = { waId: string };

// Escapes a single CSV cell per RFC 4180:
//  - wrap in double quotes
//  - double up any embedded double quotes
//  - newlines stay inside the quoted cell, no further escaping needed
function csvCell(value: string | null | undefined): string {
  const v = value ?? "";
  return `"${v.replace(/"/g, '""')}"`;
}

function toCsv(rows: ReadonlyArray<Record<string, string>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] as Record<string, string>);
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<Params> },
): Promise<NextResponse> {
  const { waId } = await ctx.params;
  const [contact, entries] = await Promise.all([
    getContact(waId),
    getConversation(waId),
  ]);

  if (!contact) {
    return NextResponse.json({ error: "contact not found" }, { status: 404 });
  }

  const rows = entries.map((e) => ({
    // LeadLogEntry.createdAt is typed as string (ISO). Wrap defensively.
    timestamp: String(e.createdAt),
    direction: e.direction,
    intent: e.intent ?? "",
    route: e.route ?? "",
    text: e.messageText ?? "",
  }));
  const csv = toCsv(rows);

  // Filename: transcript_<waid>_<YYYYMMDD>.csv. Useful for grouping exports
  // across contacts in a shared directory.
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `transcript_${waId}_${today}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

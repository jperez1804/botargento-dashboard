import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql } from "@/db/client";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { csvFilename, streamCsv, type CsvColumn } from "@/lib/csv";
import { formatDateTime } from "@/lib/date";
import { tenantConfig } from "@/config/tenant";
import { takeToken } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

type ContactRow = {
  contact_wa_id: string;
  display_name: string | null;
  first_seen: string;
  last_seen: string;
  message_count: number;
  last_intent: string | null;
  handoff_count: number;
};

const STREAM_BATCH = 500;

async function* iterateContacts(opts: {
  search?: string;
  from?: string;
  to?: string;
}): AsyncIterable<ContactRow> {
  const term = opts.search ? `%${opts.search}%` : null;
  let offset = 0;
  while (true) {
    const rows = await sql<Record<string, unknown>[]>`
      SELECT contact_wa_id, display_name, first_seen, last_seen,
             message_count, last_intent, handoff_count
      FROM automation.v_contact_summary
      WHERE 1=1
        ${opts.from ? sql`AND last_seen >= ${opts.from}::date` : sql``}
        ${opts.to ? sql`AND last_seen < (${opts.to}::date + INTERVAL '1 day')` : sql``}
        ${term ? sql`AND (display_name ILIKE ${term} OR contact_wa_id ILIKE ${term})` : sql``}
      ORDER BY last_seen DESC
      LIMIT ${STREAM_BATCH} OFFSET ${offset}
    `;
    if (rows.length === 0) return;
    for (const r of rows) {
      yield {
        contact_wa_id: String(r.contact_wa_id),
        display_name: r.display_name === null ? null : String(r.display_name),
        first_seen: new Date(r.first_seen as string | Date).toISOString(),
        last_seen: new Date(r.last_seen as string | Date).toISOString(),
        message_count: Number(r.message_count ?? 0),
        last_intent: r.last_intent === null ? null : String(r.last_intent),
        handoff_count: Number(r.handoff_count ?? 0),
      };
    }
    if (rows.length < STREAM_BATCH) return;
    offset += STREAM_BATCH;
  }
}

export async function GET(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const search = url.searchParams.get("search") ?? undefined;

  // 10 exports / minute / session
  const limit = takeToken(`export:${email}`, 10, 60_000);
  if (!limit.allowed) {
    logger.warn({ email, kind: "conversations" }, "Export rate-limited");
    return NextResponse.json(
      { error: "rate_limited", retry_after_ms: limit.resetMs },
      { status: 429 },
    );
  }

  const tenant = tenantConfig();
  const columns: CsvColumn<ContactRow>[] = [
    { key: "contact_wa_id", header: "contact_wa_id" },
    {
      key: "display_name",
      header: "display_name",
      format: (r) => r.display_name ?? "",
    },
    {
      key: "first_seen",
      header: "first_seen",
      format: (r) => formatDateTime(r.first_seen, tenant.locale, tenant.timezone),
    },
    {
      key: "last_seen",
      header: "last_seen",
      format: (r) => formatDateTime(r.last_seen, tenant.locale, tenant.timezone),
    },
    { key: "message_count", header: "message_count" },
    {
      key: "last_intent",
      header: "last_intent",
      format: (r) => r.last_intent ?? "",
    },
    { key: "handoff_count", header: "handoff_count" },
  ];

  const stream = streamCsv(iterateContacts({ from, to, search }), columns);

  await db.insert(auditLog).values({
    email,
    action: "export_csv",
    metadata: { kind: "conversations", from: from ?? null, to: to ?? null, search: search ?? null },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("conversations", from, to)}"`,
      "Cache-Control": "no-store",
    },
  });
}

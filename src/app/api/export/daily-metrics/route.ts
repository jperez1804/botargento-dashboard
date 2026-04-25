import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sql, db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { csvFilename, streamCsv, type CsvColumn } from "@/lib/csv";
import { takeToken } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

type MetricsRow = {
  day: string;
  inbound_count: number;
  outbound_count: number;
  unique_contacts: number;
  handoff_count: number;
  handoff_rate: number;
};

async function* iterateMetrics(opts: {
  from?: string;
  to?: string;
}): AsyncIterable<MetricsRow> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT day, inbound_count, outbound_count, unique_contacts,
           handoff_count, handoff_rate
    FROM automation.v_daily_metrics
    WHERE 1=1
      ${opts.from ? sql`AND day >= ${opts.from}::date` : sql``}
      ${opts.to ? sql`AND day <= ${opts.to}::date` : sql``}
    ORDER BY day ASC
  `;
  for (const r of rows) {
    yield {
      day: String(r.day),
      inbound_count: Number(r.inbound_count ?? 0),
      outbound_count: Number(r.outbound_count ?? 0),
      unique_contacts: Number(r.unique_contacts ?? 0),
      handoff_count: Number(r.handoff_count ?? 0),
      handoff_rate: Number(r.handoff_rate ?? 0),
    };
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

  const limit = takeToken(`export:${email}`, 10, 60_000);
  if (!limit.allowed) {
    logger.warn({ email, kind: "daily-metrics" }, "Export rate-limited");
    return NextResponse.json(
      { error: "rate_limited", retry_after_ms: limit.resetMs },
      { status: 429 },
    );
  }

  const columns: CsvColumn<MetricsRow>[] = [
    { key: "day", header: "day" },
    { key: "inbound_count", header: "inbound_count" },
    { key: "outbound_count", header: "outbound_count" },
    { key: "unique_contacts", header: "unique_contacts" },
    { key: "handoff_count", header: "handoff_count" },
    { key: "handoff_rate", header: "handoff_rate" },
  ];

  const stream = streamCsv(iterateMetrics({ from, to }), columns);

  await db.insert(auditLog).values({
    email,
    action: "export_csv",
    metadata: { kind: "daily-metrics", from: from ?? null, to: to ?? null },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("daily-metrics", from, to)}"`,
      "Cache-Control": "no-store",
    },
  });
}

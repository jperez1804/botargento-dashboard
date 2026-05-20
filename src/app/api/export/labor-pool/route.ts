import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { sql } from "@/db/client";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";
import { csvFilename, streamCsv, type CsvColumn } from "@/lib/csv";
import { formatDateTime } from "@/lib/date";
import { tenantConfig } from "@/config/tenant";
import { verticalConfig } from "@/config/verticals";
import { takeToken } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

type LaborExportRow = {
  created_at: string;
  worker_name: string;
  specialty: string;
  zone: string;
  mode: string;
  phone: string;
  status: string;
  contact_wa_id: string;
  lead_name: string;
  profile_name: string;
  notes: string;
};

const STREAM_BATCH = 500;

async function* iterateLabor(opts: {
  search?: string;
  specialty?: string;
  zone?: string;
  mode?: string;
  status?: string;
}): AsyncIterable<LaborExportRow> {
  const term = opts.search ? `%${opts.search}%` : null;
  const zoneTerm = opts.zone ? `%${opts.zone}%` : null;
  let offset = 0;
  while (true) {
    const rows = await sql<Record<string, unknown>[]>`
      SELECT created_at, worker_name, specialty, zone, mode, phone, status,
             contact_wa_id, lead_name, profile_name, notes
      FROM automation.v_labor_pool
      WHERE 1=1
        ${opts.specialty ? sql`AND specialty = ${opts.specialty}` : sql``}
        ${zoneTerm ? sql`AND zone ILIKE ${zoneTerm}` : sql``}
        ${opts.mode ? sql`AND mode = ${opts.mode}` : sql``}
        ${opts.status ? sql`AND status = ${opts.status}` : sql``}
        ${
          term
            ? sql`AND (worker_name ILIKE ${term}
                    OR lead_name ILIKE ${term}
                    OR profile_name ILIKE ${term})`
            : sql``
        }
      ORDER BY created_at DESC
      LIMIT ${STREAM_BATCH} OFFSET ${offset}
    `;
    if (rows.length === 0) return;
    for (const r of rows) {
      yield {
        created_at: new Date(r.created_at as string | Date).toISOString(),
        worker_name: String(r.worker_name ?? ""),
        specialty: String(r.specialty ?? ""),
        zone: String(r.zone ?? ""),
        mode: String(r.mode ?? ""),
        phone: String(r.phone ?? ""),
        status: String(r.status ?? ""),
        contact_wa_id: String(r.contact_wa_id ?? ""),
        lead_name: String(r.lead_name ?? ""),
        profile_name: String(r.profile_name ?? ""),
        notes: String(r.notes ?? ""),
      };
    }
    if (rows.length < STREAM_BATCH) return;
    offset += STREAM_BATCH;
  }
}

export async function GET(request: Request) {
  if (!verticalConfig().features?.laborPoolTab) {
    notFound();
  }

  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? undefined;
  const specialty = url.searchParams.get("specialty") ?? undefined;
  const zone = url.searchParams.get("zone") ?? undefined;
  const mode = url.searchParams.get("mode") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const limit = takeToken(`export:${email}`, 10, 60_000);
  if (!limit.allowed) {
    logger.warn({ email, kind: "labor-pool" }, "Export rate-limited");
    return NextResponse.json(
      { error: "rate_limited", retry_after_ms: limit.resetMs },
      { status: 429 },
    );
  }

  const tenant = tenantConfig();
  const columns: CsvColumn<LaborExportRow>[] = [
    {
      key: "created_at",
      header: "created_at",
      format: (r) => formatDateTime(r.created_at, tenant.locale, tenant.timezone),
    },
    { key: "worker_name", header: "worker_name" },
    { key: "specialty", header: "specialty" },
    { key: "zone", header: "zone" },
    { key: "mode", header: "mode" },
    { key: "phone", header: "phone" },
    { key: "status", header: "status" },
    { key: "contact_wa_id", header: "contact_wa_id" },
    { key: "lead_name", header: "lead_name" },
    { key: "profile_name", header: "profile_name" },
    { key: "notes", header: "notes" },
  ];

  const stream = streamCsv(
    iterateLabor({ search, specialty, zone, mode, status }),
    columns,
  );

  await db.insert(auditLog).values({
    email,
    action: "export_csv",
    metadata: {
      kind: "labor-pool",
      search: search ?? null,
      specialty: specialty ?? null,
      zone: zone ?? null,
      mode: mode ?? null,
      status: status ?? null,
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("labor-pool")}"`,
      "Cache-Control": "no-store",
    },
  });
}

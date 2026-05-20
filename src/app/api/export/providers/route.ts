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

type ProviderExportRow = {
  created_at: string;
  business_name: string;
  category: string;
  zone: string;
  email: string;
  phone: string;
  status: string;
  contact_wa_id: string;
  lead_name: string;
  profile_name: string;
  notes: string;
};

const STREAM_BATCH = 500;

async function* iterateProviders(opts: {
  search?: string;
  category?: string;
  zone?: string;
  status?: string;
}): AsyncIterable<ProviderExportRow> {
  const term = opts.search ? `%${opts.search}%` : null;
  const zoneTerm = opts.zone ? `%${opts.zone}%` : null;
  let offset = 0;
  while (true) {
    const rows = await sql<Record<string, unknown>[]>`
      SELECT created_at, business_name, category, zone, email, phone, status,
             contact_wa_id, lead_name, profile_name, notes
      FROM automation.v_providers
      WHERE 1=1
        ${opts.category ? sql`AND category = ${opts.category}` : sql``}
        ${zoneTerm ? sql`AND zone ILIKE ${zoneTerm}` : sql``}
        ${opts.status ? sql`AND status = ${opts.status}` : sql``}
        ${
          term
            ? sql`AND (business_name ILIKE ${term}
                    OR lead_name ILIKE ${term}
                    OR profile_name ILIKE ${term}
                    OR email ILIKE ${term})`
            : sql``
        }
      ORDER BY created_at DESC
      LIMIT ${STREAM_BATCH} OFFSET ${offset}
    `;
    if (rows.length === 0) return;
    for (const r of rows) {
      yield {
        created_at: new Date(r.created_at as string | Date).toISOString(),
        business_name: String(r.business_name ?? ""),
        category: String(r.category ?? ""),
        zone: String(r.zone ?? ""),
        email: String(r.email ?? ""),
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
  if (!verticalConfig().features?.providersTab) {
    notFound();
  }

  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;
  const zone = url.searchParams.get("zone") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const limit = takeToken(`export:${email}`, 10, 60_000);
  if (!limit.allowed) {
    logger.warn({ email, kind: "providers" }, "Export rate-limited");
    return NextResponse.json(
      { error: "rate_limited", retry_after_ms: limit.resetMs },
      { status: 429 },
    );
  }

  const tenant = tenantConfig();
  const columns: CsvColumn<ProviderExportRow>[] = [
    {
      key: "created_at",
      header: "created_at",
      format: (r) => formatDateTime(r.created_at, tenant.locale, tenant.timezone),
    },
    { key: "business_name", header: "business_name" },
    { key: "category", header: "category" },
    { key: "zone", header: "zone" },
    { key: "email", header: "email" },
    { key: "phone", header: "phone" },
    { key: "status", header: "status" },
    { key: "contact_wa_id", header: "contact_wa_id" },
    { key: "lead_name", header: "lead_name" },
    { key: "profile_name", header: "profile_name" },
    { key: "notes", header: "notes" },
  ];

  const stream = streamCsv(
    iterateProviders({ search, category, zone, status }),
    columns,
  );

  await db.insert(auditLog).values({
    email,
    action: "export_csv",
    metadata: {
      kind: "providers",
      search: search ?? null,
      category: category ?? null,
      zone: zone ?? null,
      status: status ?? null,
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename("providers")}"`,
      "Cache-Control": "no-store",
    },
  });
}

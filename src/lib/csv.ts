// Streaming CSV helpers. csv-stringify pipes row-by-row into a Web ReadableStream
// so multi-MB exports stay flat in memory regardless of tenant size.

import { stringify } from "csv-stringify";

export type CsvColumn<T> = {
  key: string;
  header: string;
  format?: (row: T) => string | number | null;
};

/**
 * Wraps a Drizzle/postgres row iterator into a ReadableStream<Uint8Array>
 * suitable for `new Response(stream, { headers: { "Content-Type": "text/csv" } })`.
 * The iterator runs on demand — we don't materialize all rows in memory.
 */
export function streamCsv<T>(
  rows: AsyncIterable<T>,
  columns: ReadonlyArray<CsvColumn<T>>,
): ReadableStream<Uint8Array> {
  const stringifier = stringify({
    header: true,
    columns: columns.map((c) => ({ key: c.key, header: c.header })),
  });

  const encoder = new TextEncoder();
  // UTF-8 BOM (EF BB BF) — emit explicitly so Excel auto-detects the encoding.
  // csv-stringify v6's `bom` option doesn't reliably surface through its
  // event stream, so we prepend the bytes ourselves.
  const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(BOM);
      stringifier.on("data", (chunk: Buffer | string) => {
        controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : new Uint8Array(chunk));
      });
      stringifier.on("end", () => controller.close());
      stringifier.on("error", (err) => controller.error(err));

      (async () => {
        try {
          for await (const row of rows) {
            const projected: Record<string, unknown> = {};
            for (const col of columns) {
              projected[col.key] = col.format ? col.format(row) : (row as never)[col.key];
            }
            const ok = stringifier.write(projected);
            if (!ok) await new Promise<void>((res) => stringifier.once("drain", res));
          }
          stringifier.end();
        } catch (err) {
          stringifier.destroy(err as Error);
        }
      })();
    },
  });
}

/** Filename-safe ISO date prefix (no time, no separators except dashes). */
export function csvFilename(prefix: string, from?: string, to?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const f = from ?? today;
  const t = to ?? today;
  return `${prefix}-${f}-${t}.csv`;
}

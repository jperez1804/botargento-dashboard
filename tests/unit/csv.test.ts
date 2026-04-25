import { describe, it, expect } from "vitest";
import { streamCsv, csvFilename, type CsvColumn } from "@/lib/csv";

async function readBom(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const all: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) all.push(value);
  }
  const total = all.reduce((s, c) => s + c.byteLength, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of all) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

type Row = { id: number; name: string; note: string | null };

async function* gen<T>(rows: T[]): AsyncIterable<T> {
  for (const r of rows) yield r;
}

async function readAllBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((a, c) => a + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const bytes = await readAllBytes(stream);
  // ignoreBOM so we can assert it's there byte-by-byte if we want; the
  // default decoder strips it.
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
}

describe("streamCsv", () => {
  it("emits a UTF-8 BOM + header + rows", async () => {
    const cols: CsvColumn<Row>[] = [
      { key: "id", header: "id" },
      { key: "name", header: "name" },
      { key: "note", header: "note", format: (r) => r.note ?? "" },
    ];
    const rows: Row[] = [
      { id: 1, name: "Juan", note: null },
      { id: 2, name: "María", note: "vip" },
    ];
    const bytes = await readBom(streamCsv(gen(rows), cols));
    // BOM is 3 raw bytes (EF BB BF) at the very start — verify byte-by-byte.
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);
    const out = new TextDecoder("utf-8").decode(bytes);
    const lines = out.split(/\r?\n/).filter(Boolean);
    expect(lines[0]).toBe("id,name,note");
    expect(lines[1]).toBe("1,Juan,");
    expect(lines[2]).toBe("2,María,vip");
  });

  it("escapes commas and quotes per CSV spec", async () => {
    const cols: CsvColumn<{ msg: string }>[] = [{ key: "msg", header: "msg" }];
    const rows = [{ msg: 'hola, "Juan"' }];
    const out = await readAll(streamCsv(gen(rows), cols));
    const body = out.replace(/^﻿/, "").split(/\r?\n/)[1];
    expect(body).toBe('"hola, ""Juan"""');
  });

  it("emits header even when iterator is empty", async () => {
    const cols: CsvColumn<Row>[] = [{ key: "id", header: "id" }];
    const out = await readAll(streamCsv(gen([]), cols));
    const body = out.replace(/^﻿/, "");
    expect(body.trim()).toBe("id");
  });
});

describe("csvFilename", () => {
  it("uses today for both ends when neither given", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(csvFilename("foo")).toBe(`foo-${today}-${today}.csv`);
  });

  it("interpolates given dates", () => {
    expect(csvFilename("metrics", "2026-01-01", "2026-01-31")).toBe(
      "metrics-2026-01-01-2026-01-31.csv",
    );
  });
});

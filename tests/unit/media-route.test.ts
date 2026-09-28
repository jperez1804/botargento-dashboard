// /api/media/[id]: the bytes route for stored WhatsApp media. Auth and the
// query are mocked; the handler and the header rules run for real. What is
// pinned here is mostly the security surface -- these are leads' private
// photos and voice notes, and the stored mime type comes from Meta, which we
// do not trust to pick what the browser executes.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type { MediaContent } from "@/lib/queries/media";

let authResult: { session?: { email: string; role: string }; response?: NextResponse };
const rowsById = new Map<number, MediaContent | null>();

vi.mock("@/lib/role-guard", () => ({ requireRoleApi: async () => authResult }));
vi.mock("@/lib/queries/media", () => ({
  getMediaContent: async (id: number) => rowsById.get(id) ?? null,
}));

const { GET } = await import("@/app/api/media/[id]/route");
const { headersFor, parseMediaId, baseMimeType } = await import("@/lib/media/serve");

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02]);

rowsById.set(6, { mimeType: "image/jpeg", content: JPEG });
rowsById.set(7, { mimeType: "audio/ogg; codecs=opus", content: OGG });
rowsById.set(8, { mimeType: "application/pdf", content: new Uint8Array([0x25, 0x50, 0x44, 0x46]) });
rowsById.set(9, { mimeType: "image/svg+xml", content: new Uint8Array([0x3c, 0x73, 0x76, 0x67]) });
rowsById.set(10, { mimeType: "text/html", content: new Uint8Array([0x3c, 0x68, 0x31, 0x3e]) });
// A row whose fetch failed: the query already answers null for it.
rowsById.set(11, null);

const call = (id: string) =>
  GET(new Request(`http://dashboard.test/api/media/${id}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  authResult = { session: { email: "viewer@cliente.com", role: "viewer" } };
});

describe("parseMediaId", () => {
  it("accepts only a positive integer", () => {
    expect(parseMediaId("7")).toBe(7);
    expect(parseMediaId("0")).toBeNull();
    expect(parseMediaId("-1")).toBeNull();
    expect(parseMediaId("7abc")).toBeNull();
    expect(parseMediaId("1e3")).toBeNull();
    expect(parseMediaId("")).toBeNull();
    expect(parseMediaId("../7")).toBeNull();
  });
});

describe("baseMimeType", () => {
  it("drops parameters and case, which is what a WhatsApp voice note carries", () => {
    expect(baseMimeType("audio/ogg; codecs=opus")).toBe("audio/ogg");
    expect(baseMimeType("Image/JPEG")).toBe("image/jpeg");
    expect(baseMimeType("")).toBe("");
  });
});

describe("GET /api/media/[id]", () => {
  it("401 without a session, as JSON, before parsing anything", async () => {
    authResult = { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
    const res = await call("6");
    expect(res.status).toBe(401);
  });

  it("any allowlisted user (a viewer) may see media", async () => {
    expect((await call("6")).status).toBe(200);
  });

  it("400 on a malformed id, before touching the database", async () => {
    expect((await call("not-a-number")).status).toBe(400);
  });

  it("404 when there is no row", async () => {
    expect((await call("999")).status).toBe(404);
  });

  it("404 when the row exists but its fetch failed (content NULL)", async () => {
    expect((await call("11")).status).toBe(404);
  });

  it("serves a photo inline with the exact bytes and private caching", async () => {
    const res = await call("6");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("content-length")).toBe(String(JPEG.byteLength));
    expect(res.headers.get("content-disposition")).toBe('inline; filename="media-6.jpg"');
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);
  });

  it("serves a voice note as audio/ogg, parameters stripped", async () => {
    const res = await call("7");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/ogg");
    expect(res.headers.get("content-disposition")).toBe('inline; filename="media-7.ogg"');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(OGG);
  });

  it("serves a PDF inline (the browser viewer), which is what a plan needs", async () => {
    const res = await call("8");
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('inline; filename="media-8.pdf"');
  });

  it("never renders SVG inline on the dashboard's origin -- it can carry script", async () => {
    const res = await call("9");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="media-9.bin"');
  });

  it("never renders HTML inline either, whatever Meta said the type was", async () => {
    const res = await call("10");
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("headersFor", () => {
  it("is the same table the route uses", () => {
    const h = headersFor({ id: 3, mime: "audio/mpeg", byteLength: 12 });
    expect(h["Content-Type"]).toBe("audio/mpeg");
    expect(h["Content-Disposition"]).toBe('inline; filename="media-3.mp3"');
    expect(h["Content-Length"]).toBe("12");
  });
  it("treats an unknown or empty type as a download", () => {
    expect(headersFor({ id: 1, mime: "", byteLength: 1 })["Content-Type"]).toBe("application/octet-stream");
    expect(headersFor({ id: 1, mime: "video/mp4", byteLength: 1 })["Content-Disposition"]).toMatch(/^attachment;/);
  });
});

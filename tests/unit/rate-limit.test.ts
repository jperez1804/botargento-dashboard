import { describe, it, expect, beforeEach, vi } from "vitest";
import { takeToken } from "@/lib/rate-limit";

describe("takeToken", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-25T00:00:00Z"));
  });

  it("allows up to capacity then blocks", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 10; i++) {
      const r = takeToken(key, 10, 60_000);
      expect(r.allowed).toBe(true);
    }
    const next = takeToken(key, 10, 60_000);
    expect(next.allowed).toBe(false);
    expect(next.resetMs).toBeGreaterThan(0);
  });

  it("refills tokens at the configured rate", () => {
    const key = `test-${Math.random()}`;
    // Drain
    for (let i = 0; i < 10; i++) takeToken(key, 10, 60_000);
    expect(takeToken(key, 10, 60_000).allowed).toBe(false);

    // Wait 30 seconds → ~5 tokens refilled
    vi.advanceTimersByTime(30_000);
    let allowedAfter30s = 0;
    while (takeToken(key, 10, 60_000).allowed) allowedAfter30s++;
    expect(allowedAfter30s).toBeGreaterThanOrEqual(4);
    expect(allowedAfter30s).toBeLessThanOrEqual(6);
  });

  it("uses independent buckets per key", () => {
    for (let i = 0; i < 10; i++) takeToken("alice", 10, 60_000);
    expect(takeToken("alice", 10, 60_000).allowed).toBe(false);
    expect(takeToken("bob", 10, 60_000).allowed).toBe(true);
  });
});

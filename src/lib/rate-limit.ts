// In-process token bucket. Sufficient for v1 — one container per tenant means
// per-instance rate limits are also per-tenant rate limits. Move to Redis if
// we ever scale a single tenant horizontally.

type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
};

/**
 * Sliding-window-ish bucket. Refills at `capacity / windowMs` per ms, cap at
 * `capacity`. Each call subtracts 1 token.
 */
export function takeToken(key: string, capacity: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const refillRate = capacity / windowMs;
  const existing = buckets.get(key);
  let tokens = existing ? existing.tokens : capacity;
  if (existing) {
    const elapsed = now - existing.updatedAt;
    tokens = Math.min(capacity, existing.tokens + elapsed * refillRate);
  }
  if (tokens >= 1) {
    tokens -= 1;
    buckets.set(key, { tokens, updatedAt: now });
    return { allowed: true, remaining: Math.floor(tokens), resetMs: 0 };
  }
  buckets.set(key, { tokens, updatedAt: now });
  const msUntilNext = (1 - tokens) / refillRate;
  return { allowed: false, remaining: 0, resetMs: Math.ceil(msUntilNext) };
}

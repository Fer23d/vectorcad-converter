type Bucket = { count: number; resetAt: number };
export type RateLimitDecision = { allowed: boolean; remaining: number; retryAfterSeconds: number; backend: "shared" | "local" };

const buckets = new Map<string, Bucket>();

function consumeLocal(key: string, limit: number, windowMs: number): RateLimitDecision {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0, backend: "local" };
  }
  if (current.count >= limit) return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000), backend: "local" };
  current.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - current.count), retryAfterSeconds: 0, backend: "local" };
}

/** Uses Upstash Redis when configured, with a bounded process-local fallback for development. */
export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return consumeLocal(key, limit, windowMs);
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["PEXPIRE", key, windowMs, "NX"]]),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("RATE_LIMIT_STORE_UNAVAILABLE");
    const result = await response.json() as Array<{ result?: number }>;
    const count = Number(result?.[0]?.result);
    if (!Number.isFinite(count)) throw new Error("RATE_LIMIT_STORE_INVALID");
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds: count <= limit ? 0 : Math.ceil(windowMs / 1000), backend: "shared" };
  } catch {
    return consumeLocal(key, limit, windowMs);
  }
}

export function requestAddress(request: Request) {
  return request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

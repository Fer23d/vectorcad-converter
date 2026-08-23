import { recordSecurityEvent } from "@/lib/security/security-events";
import { secureLogger } from "@/lib/security/logger";

type Bucket = { count: number; resetAt: number };
export type RateLimitFailureMode = "open" | "closed";
export type RateLimitDecision = { allowed: boolean; remaining: number; retryAfterSeconds: number; backend: "shared" | "local" | "unavailable"; degraded: boolean };

const buckets = new Map<string, Bucket>();

function consumeLocal(key: string, limit: number, windowMs: number): RateLimitDecision {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0, backend: "local", degraded: false };
  }
  if (current.count >= limit) return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000), backend: "local", degraded: false };
  current.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - current.count), retryAfterSeconds: 0, backend: "local", degraded: false };
}

function failureDecision(failureMode: RateLimitFailureMode): RateLimitDecision {
  return { allowed: failureMode !== "closed", remaining: 0, retryAfterSeconds: 60, backend: "unavailable", degraded: true };
}

function rateLimitCategory(key: string) {
  return key.split(":")[0] || "unknown";
}

async function reportUnavailable(reason: string, key: string) {
  secureLogger.error("[rate-limit] shared backend unavailable", { category: rateLimitCategory(key), reason });
  await recordSecurityEvent({
    eventType: "RATE_LIMIT_BACKEND_UNAVAILABLE",
    success: false,
    metadata: { category: rateLimitCategory(key), reason, environment: process.env.NODE_ENV || "unknown" },
  });
}

/** Uses Upstash Redis in production. The local fallback is development-only. */
export async function consumeRateLimit(key: string, limit: number, windowMs: number, options: { failureMode?: RateLimitFailureMode } = {}): Promise<RateLimitDecision> {
  const failureMode = options.failureMode || "open";
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      await reportUnavailable("UPSTASH_NOT_CONFIGURED", key);
      return failureDecision(failureMode);
    }
    return consumeLocal(key, limit, windowMs);
  }
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
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds: count <= limit ? 0 : Math.ceil(windowMs / 1000), backend: "shared", degraded: false };
  } catch (error) {
    await reportUnavailable(error instanceof Error ? error.message : "RATE_LIMIT_STORE_UNAVAILABLE", key);
    if (process.env.NODE_ENV === "production") return failureDecision(failureMode);
    return consumeLocal(key, limit, windowMs);
  }
}

export function requestAddress(request: Request) {
  return request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

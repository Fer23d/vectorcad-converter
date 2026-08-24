import { recordSecurityEvent } from "@/lib/security/security-events";
import { secureLogger } from "@/lib/security/logger";

type Bucket = { count: number; resetAt: number };
export type RateLimitFailureMode = "open" | "closed";
export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  backend: "shared" | "local" | "unavailable";
  degraded: boolean;
  reason: "RATE_LIMIT_OK" | "RATE_LIMIT_EXCEEDED" | "RATE_LIMIT_BACKEND_UNAVAILABLE";
  status?: number;
};

const buckets = new Map<string, Bucket>();

function consumeLocal(key: string, limit: number, windowMs: number): RateLimitDecision {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0, backend: "local", degraded: false, reason: "RATE_LIMIT_OK" };
  }
  if (current.count >= limit) return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000), backend: "local", degraded: false, reason: "RATE_LIMIT_EXCEEDED" };
  current.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - current.count), retryAfterSeconds: 0, backend: "local", degraded: false, reason: "RATE_LIMIT_OK" };
}

function failureDecision(failureMode: RateLimitFailureMode, status?: number): RateLimitDecision {
  return { allowed: failureMode !== "closed", remaining: 0, retryAfterSeconds: 60, backend: "unavailable", degraded: true, reason: "RATE_LIMIT_BACKEND_UNAVAILABLE", status };
}

function rateLimitCategory(key: string) {
  return key.split(":")[0] || "unknown";
}

async function reportUnavailable(reason: string, key: string, status?: number) {
  secureLogger.error("[rate-limit] shared backend unavailable", { category: rateLimitCategory(key), reason, backend: "upstash", status: status || null });
  await recordSecurityEvent({
    eventType: "RATE_LIMIT_BACKEND_UNAVAILABLE",
    success: false,
    metadata: { category: rateLimitCategory(key), reason, backend: "upstash", status: status || null, environment: process.env.NODE_ENV || "unknown" },
  });
}

function normalizeUpstashUrl(value: string) {
  const url = value.trim().replace(/^["']|["']$/g, "").replace(/\/$/, "");
  if (!/^https:\/\/.+/i.test(url)) throw new Error("UPSTASH_REST_URL_INVALID");
  if (url.includes("redis://") || url.includes("rediss://")) throw new Error("UPSTASH_REST_URL_INVALID");
  return url;
}

function normalizeUpstashToken(value: string) {
  const token = value.trim().replace(/^["']|["']$/g, "");
  if (!token || token.includes("[SENSITIVE]")) throw new Error("UPSTASH_REST_TOKEN_INVALID");
  return token;
}

function upstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: normalizeUpstashUrl(url), token: normalizeUpstashToken(token) };
}

function upstashPipelineResults(value: unknown): Array<{ result?: unknown; error?: unknown }> {
  if (Array.isArray(value)) return value as Array<{ result?: unknown; error?: unknown }>;
  if (value && typeof value === "object" && Array.isArray((value as { result?: unknown }).result)) {
    return (value as { result: Array<{ result?: unknown; error?: unknown }> }).result;
  }
  throw new Error("RATE_LIMIT_STORE_INVALID");
}

function parseIncrementResult(value: unknown) {
  const results = upstashPipelineResults(value);
  const first = results[0];
  if (!first || first.error) throw new Error("RATE_LIMIT_STORE_INVALID");
  const count = Number(first.result);
  if (!Number.isFinite(count)) throw new Error("RATE_LIMIT_STORE_INVALID");
  return count;
}

/** Uses Upstash Redis in production. The local fallback is development-only. */
export async function consumeRateLimit(key: string, limit: number, windowMs: number, options: { failureMode?: RateLimitFailureMode } = {}): Promise<RateLimitDecision> {
  const failureMode = options.failureMode || "open";
  let config: { url: string; token: string } | null = null;
  try {
    config = upstashConfig();
  } catch (error) {
    await reportUnavailable(error instanceof Error ? error.message : "UPSTASH_CONFIG_INVALID", key);
    return process.env.NODE_ENV === "production" ? failureDecision(failureMode) : consumeLocal(key, limit, windowMs);
  }
  if (!config) {
    if (process.env.NODE_ENV === "production") {
      await reportUnavailable("UPSTASH_NOT_CONFIGURED", key);
      return failureDecision(failureMode);
    }
    return consumeLocal(key, limit, windowMs);
  }
  try {
    const response = await fetch(`${config.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["PEXPIRE", key, windowMs, "NX"]]),
      cache: "no-store",
    });
    if (!response.ok) {
      const error = new Error("RATE_LIMIT_STORE_UNAVAILABLE") as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    const count = parseIncrementResult(await response.json());
    const allowed = count <= limit;
    return { allowed, remaining: Math.max(0, limit - count), retryAfterSeconds: allowed ? 0 : Math.ceil(windowMs / 1000), backend: "shared", degraded: false, reason: allowed ? "RATE_LIMIT_OK" : "RATE_LIMIT_EXCEEDED" };
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number((error as { status?: unknown }).status) : undefined;
    await reportUnavailable(error instanceof Error ? error.message : "RATE_LIMIT_STORE_UNAVAILABLE", key, Number.isFinite(status) ? status : undefined);
    if (process.env.NODE_ENV === "production") return failureDecision(failureMode, Number.isFinite(status) ? status : undefined);
    return consumeLocal(key, limit, windowMs);
  }
}

export function requestAddress(request: Request) {
  return request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

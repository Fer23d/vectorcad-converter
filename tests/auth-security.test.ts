import { afterEach, describe, expect, it, vi } from "vitest";
import { SECURITY_EVENT_TYPES, sanitizeSecurityMetadata } from "@/lib/security/security-events";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const originalEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  redisUrl: process.env.UPSTASH_REDIS_REST_URL,
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
};

afterEach(() => {
  vi.restoreAllMocks();
  if (originalEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnvironment.nodeEnv;
  if (originalEnvironment.redisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = originalEnvironment.redisUrl;
  if (originalEnvironment.redisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = originalEnvironment.redisToken;
});

describe("security event infrastructure", () => {
  it("defines the initial security event vocabulary", () => {
    expect(SECURITY_EVENT_TYPES).toEqual(expect.arrayContaining([
      "LOGIN_SUCCESS",
      "LOGIN_FAILED",
      "ACCOUNT_LOCKED",
      "PASSWORD_RESET_REQUESTED",
      "PASSWORD_CHANGED",
      "EMAIL_CONFIRMED",
      "LOGOUT",
    ]));
  });

  it("redacts sensitive metadata without retaining credentials", () => {
    const result = sanitizeSecurityMetadata({
      attempt: 2,
      password: "never-store",
      accessToken: "never-store",
      recoveryLink: "https://example.invalid/recovery?token=secret",
      nested: { userAgent: "browser", imageData: "data:image/png;base64,secret" },
    });
    expect(result).toMatchObject({
      attempt: 2,
      password: "[REDACTED]",
      accessToken: "[REDACTED]",
      recoveryLink: "[REDACTED]",
      nested: { userAgent: "browser", imageData: "[REDACTED]" },
    });
    expect(JSON.stringify(result)).not.toContain("never-store");
  });

  it("uses the local fallback only outside production", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const key = `auth-security-local:${Date.now()}`;
    expect((await consumeRateLimit(key, 1, 60_000)).backend).toBe("local");
    expect((await consumeRateLimit(key, 1, 60_000)).allowed).toBe(false);
  });

  it("fails closed in production when Redis is not configured", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const decision = await consumeRateLimit(`auth-login:${Date.now()}`, 5, 60_000, { failureMode: "closed" });
    expect(decision).toMatchObject({ allowed: false, backend: "unavailable", degraded: true });
  });

  it("uses Redis when configured and returns a shared decision", async () => {
    process.env.NODE_ENV = "production";
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.invalid";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{ result: 1 }, { result: 1 }]), { status: 200 })));
    const decision = await consumeRateLimit(`auth-login:${Date.now()}`, 5, 60_000, { failureMode: "closed" });
    expect(decision).toMatchObject({ allowed: true, backend: "shared", degraded: false });
  });

  it("keeps the event table private and service-role managed", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260820120000_auth_security_events.sql"), "utf8");
    expect(sql).toContain("alter table public.auth_security_events enable row level security");
    expect(sql).toContain("for insert to service_role");
    expect(sql).toContain("for select to service_role");
    expect(sql).not.toContain("to anon");
  });
});

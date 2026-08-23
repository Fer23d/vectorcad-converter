import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn();
const consumeRateLimit = vi.fn();
const recordSecurityEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseServerConfigured: true,
  isSupabaseAdminConfigured: false,
  createSupabaseAuthServerClient: () => ({
    auth: { signInWithPassword },
  }),
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit,
  requestAddress: () => "203.0.113.10",
}));

vi.mock("@/lib/security/security-events", () => ({
  recordSecurityEvent,
}));

function decision(allowed = true) {
  return { allowed, remaining: allowed ? 1 : 0, retryAfterSeconds: allowed ? 0 : 60, backend: "shared", degraded: false };
}

function loginRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Vitest" },
    body: JSON.stringify(body),
  });
}

async function postLogin(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/auth/login/route");
  const response = await POST(loginRequest(body));
  return { response, body: await response.json() };
}

describe("auth login hardening endpoint", () => {
  const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.clearAllMocks();
    consumeRateLimit.mockResolvedValue(decision(true));
    recordSecurityEvent.mockResolvedValue({ ok: true });
    signInWithPassword.mockReset();
  });

  afterEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken;
  });

  it("authenticates through Supabase and returns a Supabase session", async () => {
    signInWithPassword.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "user@example.com", email_confirmed_at: "2026-08-23T10:00:00Z" },
        session: { access_token: "access-token", refresh_token: "refresh-token" },
      },
      error: null,
    });

    const { response, body } = await postLogin({ email: " USER@EXAMPLE.COM ", password: "correct-password" });

    expect(response.status).toBe(200);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "user@example.com", password: "correct-password" });
    expect(body.session).toEqual({ access_token: "access-token", refresh_token: "refresh-token" });
    expect(recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "LOGIN_SUCCESS", success: true, userId: "user-1" }));
  });

  it("returns a generic response for invalid credentials", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: { message: "Invalid login credentials" } });

    const { response, body } = await postLogin({ email: "user@example.com", password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(body.error).toBe("Não foi possível entrar. Verifique os dados e tente novamente.");
    expect(body.error).not.toMatch(/existe|cadastrado|inválida/i);
    expect(recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "LOGIN_FAILED", success: false }));
  });

  it("blocks abusive login attempts by IP", async () => {
    consumeRateLimit.mockResolvedValueOnce(decision(false)).mockResolvedValueOnce(decision(true));

    const { response, body } = await postLogin({ email: "user@example.com", password: "valid-length" });

    expect(response.status).toBe(429);
    expect(body.error).toBe("Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.");
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "ACCOUNT_LOCKED", success: false }));
  });

  it("blocks abusive failed attempts by email", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: { message: "Invalid login credentials" } });
    consumeRateLimit.mockResolvedValueOnce(decision(true)).mockResolvedValueOnce(decision(true)).mockResolvedValueOnce(decision(false));

    const { response } = await postLogin({ email: "user@example.com", password: "wrong-password" });

    expect(response.status).toBe(429);
    expect(recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "ACCOUNT_LOCKED", success: false }));
  });

  it("uses fail-closed rate limit decisions for login keys", async () => {
    signInWithPassword.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "user@example.com", email_confirmed_at: "2026-08-23T10:00:00Z" },
        session: { access_token: "access-token", refresh_token: "refresh-token" },
      },
      error: null,
    });

    await postLogin({ email: "user@example.com", password: "correct-password" });

    expect(consumeRateLimit).toHaveBeenCalledWith("auth:login:ip:203.0.113.10", 10, 5 * 60 * 1000, { failureMode: "closed" });
    expect(consumeRateLimit).toHaveBeenCalledWith("auth:login:pair:203.0.113.10:user_40example.com", 5, 10 * 60 * 1000, { failureMode: "closed" });
  });

  it("does not store passwords or tokens in security events", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: { message: "Invalid login credentials" } });

    await postLogin({ email: "user@example.com", password: "super-secret-password" });

    const serializedEvents = JSON.stringify(recordSecurityEvent.mock.calls);
    expect(serializedEvents).not.toContain("super-secret-password");
    expect(serializedEvents).not.toContain("access-token");
    expect(serializedEvents).not.toContain("refresh-token");
    expect(serializedEvents).not.toContain("user@example.com");
  });
});

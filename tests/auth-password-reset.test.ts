import { beforeEach, describe, expect, it, vi } from "vitest";

const generateLink = vi.fn();
const getUser = vi.fn();
const updateUser = vi.fn();
const consumeRateLimit = vi.fn();
const recordSecurityEvent = vi.fn();
const sendPasswordResetEmail = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseAdminConfigured: true,
  isSupabaseServerConfigured: true,
  createSupabaseAdminClient: () => ({
    auth: { admin: { generateLink } },
  }),
  createSupabaseAuthServerClient: () => ({
    auth: { getUser, updateUser },
  }),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit,
  requestAddress: () => "203.0.113.20",
}));

vi.mock("@/lib/security/security-events", () => ({
  recordSecurityEvent,
}));

vi.mock("@/lib/resend", () => ({
  sendPasswordResetEmail,
}));

function decision(allowed = true) {
  return { allowed, remaining: allowed ? 1 : 0, retryAfterSeconds: allowed ? 0 : 60, backend: "shared", degraded: false };
}

async function postPasswordReset(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/email/password-reset/route");
  const response = await POST(new Request("http://localhost/api/email/password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Vitest" },
    body: JSON.stringify(body),
  }));
  return { response, body: await response.json() };
}

async function postPasswordChange(body: Record<string, unknown>, token = "recovery-access-token") {
  const { POST } = await import("@/app/api/auth/password-change/route");
  const response = await POST(new Request("http://localhost/api/auth/password-change", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "Vitest" },
    body: JSON.stringify(body),
  }));
  return { response, body: await response.json() };
}

describe("password reset hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeRateLimit.mockResolvedValue(decision(true));
    recordSecurityEvent.mockResolvedValue({ ok: true });
    sendPasswordResetEmail.mockResolvedValue(undefined);
    generateLink.mockResolvedValue({
      data: {
        user: { user_metadata: { first_name: "User" } },
        properties: { action_link: "https://example.supabase.co/auth/v1/verify?type=recovery&token_hash=abc&redirect_to=https%3A%2F%2Fvetorcad.com.br%2Freset-password" },
      },
      error: null,
    });
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    updateUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("accepts a valid reset request with a generic response", async () => {
    const { response, body } = await postPasswordReset({ email: " USER@EXAMPLE.COM " });

    expect(response.status).toBe(200);
    expect(body.message).toBe("Se esse e-mail estiver cadastrado, enviaremos um link de recuperação.");
    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: "recovery", email: "user@example.com" }));
    expect(sendPasswordResetEmail).toHaveBeenCalled();
    expect(recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "PASSWORD_RESET_REQUESTED", success: true }));
  });

  it("does not reveal invalid reset input", async () => {
    const { response, body } = await postPasswordReset({ email: "invalid" });

    expect(response.status).toBe(200);
    expect(body.message).toBe("Se esse e-mail estiver cadastrado, enviaremos um link de recuperação.");
    expect(generateLink).not.toHaveBeenCalled();
    expect(recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "PASSWORD_RESET_FAILED", success: false }));
  });

  it("blocks excessive reset requests with fail-closed rate limits", async () => {
    consumeRateLimit.mockResolvedValueOnce(decision(false)).mockResolvedValueOnce(decision(true));

    const { response, body } = await postPasswordReset({ email: "user@example.com" });

    expect(response.status).toBe(429);
    expect(body.error).toBe("Muitas solicitações. Aguarde alguns minutos antes de tentar novamente.");
    expect(recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "PASSWORD_RESET_FAILED", success: false }));
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("does not reveal whether the reset email exists", async () => {
    generateLink.mockResolvedValue({ data: { properties: null }, error: { code: "user_not_found", message: "User not found" } });

    const { response, body } = await postPasswordReset({ email: "missing@example.com" });

    expect(response.status).toBe(200);
    expect(body.message).toBe("Se esse e-mail estiver cadastrado, enviaremos um link de recuperação.");
    expect(JSON.stringify(body)).not.toMatch(/not found|missing|existe/i);
  });
});

describe("password change hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeRateLimit.mockResolvedValue(decision(true));
    recordSecurityEvent.mockResolvedValue({ ok: true });
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    updateUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("changes the password through Supabase and records an event", async () => {
    const { response, body } = await postPasswordChange({ password: "StrongPass123", confirmPassword: "StrongPass123" });

    expect(response.status).toBe(200);
    expect(body.signOutCurrentSession).toBe(true);
    expect(updateUser).toHaveBeenCalledWith({ password: "StrongPass123" });
    expect(recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "PASSWORD_CHANGED", success: true, userId: "user-1" }));
  });

  it("blocks abusive password change attempts", async () => {
    consumeRateLimit.mockResolvedValueOnce(decision(false));

    const { response, body } = await postPasswordChange({ password: "StrongPass123", confirmPassword: "StrongPass123" });

    expect(response.status).toBe(429);
    expect(body.error).toBe("Muitas tentativas de alteração de senha. Aguarde alguns minutos antes de tentar novamente.");
    expect(updateUser).not.toHaveBeenCalled();
    expect(recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "PASSWORD_CHANGE_BLOCKED", success: false }));
  });

  it("does not store password or token values in events", async () => {
    await postPasswordChange({ password: "DoNotStore123", confirmPassword: "DoNotStore123" }, "secret-recovery-token");

    const serializedEvents = JSON.stringify(recordSecurityEvent.mock.calls);
    expect(serializedEvents).not.toContain("DoNotStore123");
    expect(serializedEvents).not.toContain("secret-recovery-token");
  });
});

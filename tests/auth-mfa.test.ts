import { afterEach, describe, expect, it, vi } from "vitest";

function adminRequest() {
  return new Request("http://localhost/admin", {
    headers: { Authorization: "Bearer admin-token", "User-Agent": "Vitest" },
  });
}

function adminClientMock(options: { role?: string; adminHasMfa?: boolean }) {
  return {
    auth: {
      admin: {
        mfa: {
          listFactors: vi.fn().mockResolvedValue({
            data: { factors: options.adminHasMfa ? [{ id: "factor-1", factor_type: "totp", status: "verified" }] : [] },
            error: null,
          }),
        },
      },
    },
    from: vi.fn((table: string) => {
      if (table !== "user_roles") throw new Error(`Unexpected table ${table}`);
      return {
        select: vi.fn(() => ({
          eq: vi.fn((column: string) => {
            if (column === "user_id") {
              return { maybeSingle: vi.fn().mockResolvedValue({ data: { role: options.role || "ADMIN" }, error: null }) };
            }
            return Promise.resolve({ data: [{ user_id: "admin-1", role: "ADMIN" }], error: null });
          }),
        })),
      };
    }),
  };
}

async function loadAdminAuth(options: { role?: string; aal?: string; adminHasMfa?: boolean }) {
  vi.resetModules();
  const recordSecurityEvent = vi.fn().mockResolvedValue({ ok: true });
  const adminClient = adminClientMock(options);
  const authClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "admin-1", email: "admin@example.com", email_confirmed_at: "2026-08-23T10:00:00Z" } },
        error: null,
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: { currentLevel: options.aal || "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
          error: null,
        }),
      },
    },
  };

  vi.doMock("@/lib/supabase/server", () => ({
    isSupabaseServerConfigured: true,
    isSupabaseAdminConfigured: true,
    createSupabaseAuthServerClient: () => authClient,
    createSupabaseAdminClient: () => adminClient,
  }));
  vi.doMock("@/lib/security/security-events", () => ({ recordSecurityEvent }));

  const mod = await import("@/lib/admin-auth");
  return { ...mod, recordSecurityEvent };
}

async function loadMfaStatus(options: { setupRequired: boolean; aal?: string }) {
  vi.resetModules();
  const recordSecurityEvent = vi.fn().mockResolvedValue({ ok: true });
  vi.doMock("@/lib/admin-auth", () => ({
    requireAdmin: vi.fn().mockResolvedValue({
      role: "ADMIN",
      token: "admin-token",
      user: { id: "admin-1" },
    }),
  }));
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseAuthServerClient: () => ({
      auth: {
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: { currentLevel: options.aal || "aal1", nextLevel: "aal2", currentAuthenticationMethods: [] },
            error: null,
          }),
          listFactors: vi.fn().mockResolvedValue({
            data: { all: options.setupRequired ? [] : [{ id: "factor-1", factor_type: "totp", status: "verified" }] },
            error: null,
          }),
        },
      },
    }),
  }));
  vi.doMock("@/lib/security/security-events", () => ({ recordSecurityEvent }));
  const route = await import("@/app/api/auth/mfa/status/route");
  return { route, recordSecurityEvent };
}

async function loadMfaReset(options: {
  requireAdminResult?: unknown;
  factors?: Array<{ id: string; factor_type: string; status: string }>;
  listError?: { name?: string; message?: string } | null;
  deleteError?: { name?: string; message?: string } | null;
}) {
  vi.resetModules();
  const recordSecurityEvent = vi.fn().mockResolvedValue({ ok: true });
  const deleteFactor = vi.fn().mockResolvedValue({ data: { id: "deleted-factor" }, error: options.deleteError || null });
  const listFactors = vi.fn().mockResolvedValue({
    data: { factors: options.factors || [{ id: "totp-verified", factor_type: "totp", status: "verified" }] },
    error: options.listError || null,
  });
  const adminClient = {
    auth: {
      admin: {
        mfa: { listFactors, deleteFactor },
      },
    },
  };
  vi.doMock("@/lib/admin-auth", () => ({
    requireAdmin: vi.fn().mockResolvedValue(options.requireAdminResult || {
      role: "ADMIN",
      token: "admin-token",
      user: { id: "admin-1" },
      adminClient,
    }),
  }));
  vi.doMock("@/lib/security/security-events", () => ({ recordSecurityEvent }));
  vi.doMock("@/lib/security/rate-limit", () => ({ requestAddress: () => "203.0.113.10" }));

  const route = await import("@/app/api/auth/mfa/reset/route");
  return { route, recordSecurityEvent, listFactors, deleteFactor };
}

function resetRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/auth/mfa/reset", {
    method: "POST",
    headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json", "User-Agent": "Vitest" },
    body: JSON.stringify(body),
  });
}

describe("admin MFA hardening", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/lib/supabase/server");
    vi.doUnmock("@/lib/security/security-events");
    vi.doUnmock("@/lib/admin-auth");
    vi.doUnmock("@/lib/security/rate-limit");
  });

  it("allows an admin without MFA to start setup through the MFA status endpoint", async () => {
    const { route } = await loadMfaStatus({ setupRequired: true, aal: "aal1" });
    const response = await route.GET(adminRequest()) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.setupRequired).toBe(true);
    expect(body.mfaSatisfied).toBe(false);
  });

  it("rejects critical admin operations when the admin session is AAL1", async () => {
    const { requireAdminWithMFA } = await loadAdminAuth({ aal: "aal1", adminHasMfa: true });
    const result = await requireAdminWithMFA(adminRequest());

    expect("response" in result).toBe(true);
    if ("response" in result && result.response) expect(result.response.status).toBe(403);
  });

  it("allows critical admin operations when the admin session is AAL2", async () => {
    const { requireAdminWithMFA } = await loadAdminAuth({ aal: "aal2", adminHasMfa: true });
    const result = await requireAdminWithMFA(adminRequest());

    expect("response" in result).toBe(false);
  });

  it("keeps requireAdmin compatible for common users by preserving role checks", async () => {
    const { requireAdmin } = await loadAdminAuth({ role: "USER", aal: "aal1", adminHasMfa: false });
    const result = await requireAdmin(adminRequest());

    expect("response" in result).toBe(true);
    if ("response" in result && result.response) expect(result.response.status).toBe(403);
  });

  it("records MFA required without storing codes or secrets", async () => {
    const { requireAdminWithMFA, recordSecurityEvent } = await loadAdminAuth({ aal: "aal1", adminHasMfa: true });
    await requireAdminWithMFA(adminRequest());

    const serialized = JSON.stringify(recordSecurityEvent.mock.calls);
    expect(serialized).toContain("MFA_REQUIRED");
    expect(serialized).not.toContain("123456");
    expect(serialized).not.toContain("otpauth");
    expect(serialized).not.toContain("secret");
  });

  it("identifies pending unverified TOTP factors without selecting verified factors", async () => {
    const { findTotpFactor } = await import("@/components/mfa-setup");
    const factors = [
      { id: "phone-1", factor_type: "phone", status: "unverified" },
      { id: "totp-pending", factor_type: "totp", status: "unverified" },
      { id: "totp-verified", factor_type: "totp", status: "verified" },
    ];

    expect(findTotpFactor(factors, "unverified")?.id).toBe("totp-pending");
    expect(findTotpFactor(factors, "verified")?.id).toBe("totp-verified");
  });

  it("keeps Supabase MFA QR data URLs intact and wraps only raw SVG", async () => {
    const { safeSvgDataUrl } = await import("@/components/mfa-setup");
    const dataUrl = "data:image/svg+xml;utf-8,%3Csvg%3E%3C/svg%3E";

    expect(safeSvgDataUrl(dataUrl)).toBe(dataUrl);
    expect(safeSvgDataUrl("<svg></svg>")).toBe("data:image/svg+xml;utf-8,%3Csvg%3E%3C%2Fsvg%3E");
  });

  it("sanitizes MFA diagnostics without storing tokens, secrets or otpauth URLs", async () => {
    const { safeMfaErrorDetails } = await import("@/components/mfa-setup");
    const details = safeMfaErrorDetails({
      name: "AuthApiError",
      code: "mfa_factor_name_conflict",
      status: 422,
      message: "Failed with otpauth://totp/VetorCAD?secret=ABC123 and access_token=SECRET",
    });
    const serialized = JSON.stringify(details);

    expect(details.code).toBe("mfa_factor_name_conflict");
    expect(serialized).not.toContain("ABC123");
    expect(serialized).not.toContain("SECRET");
    expect(serialized).not.toContain("otpauth://");
  });

  it("allows an admin to reset only their own TOTP factors", async () => {
    const { route, deleteFactor, recordSecurityEvent } = await loadMfaReset({
      factors: [
        { id: "totp-verified", factor_type: "totp", status: "verified" },
        { id: "phone-verified", factor_type: "phone", status: "verified" },
      ],
    });

    const response = await route.POST(resetRequest()) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.removedFactors).toBe(1);
    expect(deleteFactor).toHaveBeenCalledTimes(1);
    expect(deleteFactor).toHaveBeenCalledWith({ userId: "admin-1", id: "totp-verified" });
    expect(JSON.stringify(deleteFactor.mock.calls)).not.toContain("phone-verified");
    expect(recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "MFA_RESET", success: true, userId: "admin-1" }));
  });

  it("blocks MFA reset when there is no authenticated admin session", async () => {
    const { route, deleteFactor } = await loadMfaReset({
      requireAdminResult: { response: Response.json({ error: "Sessão ausente." }, { status: 401 }) },
    });

    const response = await route.POST(resetRequest()) as Response;

    expect(response.status).toBe(401);
    expect(deleteFactor).not.toHaveBeenCalled();
  });

  it("blocks common users through requireAdmin before resetting MFA", async () => {
    const { route, deleteFactor } = await loadMfaReset({
      requireAdminResult: { response: Response.json({ error: "Acesso não autorizado." }, { status: 403 }) },
    });

    const response = await route.POST(resetRequest()) as Response;

    expect(response.status).toBe(403);
    expect(deleteFactor).not.toHaveBeenCalled();
  });

  it("returns a safe error when the requested TOTP factor does not belong to the authenticated admin", async () => {
    const { route, deleteFactor, recordSecurityEvent } = await loadMfaReset({
      factors: [{ id: "own-totp", factor_type: "totp", status: "verified" }],
    });

    const response = await route.POST(resetRequest({ factorId: "other-user-factor" })) as Response;
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Nenhum fator TOTP elegível para redefinição foi encontrado.");
    expect(deleteFactor).not.toHaveBeenCalled();
    expect(recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "MFA_RESET", success: false, userId: "admin-1" }));
  });

  it("returns a safe error when no TOTP factor exists", async () => {
    const { route, deleteFactor } = await loadMfaReset({
      factors: [{ id: "phone-verified", factor_type: "phone", status: "verified" }],
    });

    const response = await route.POST(resetRequest()) as Response;

    expect(response.status).toBe(404);
    expect(deleteFactor).not.toHaveBeenCalled();
  });
});

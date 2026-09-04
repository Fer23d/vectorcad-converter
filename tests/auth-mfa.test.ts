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

describe("admin MFA hardening", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/lib/supabase/server");
    vi.doUnmock("@/lib/security/security-events");
    vi.doUnmock("@/lib/admin-auth");
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
});

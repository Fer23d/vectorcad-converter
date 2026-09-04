import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_BRIDGE_COOKIE,
  signSessionBridgePayload,
  verifySessionBridgeCookie,
  type SessionBridgePayload,
} from "@/lib/security/session-bridge";

const getUser = vi.fn();
const getAuthenticatorAssuranceLevel = vi.fn();
const maybeSingle = vi.fn();
const recordSecurityEvent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseServerConfigured: true,
  isSupabaseAdminConfigured: true,
  createSupabaseAuthServerClient: () => ({
    auth: { getUser, mfa: { getAuthenticatorAssuranceLevel } },
  }),
  createSupabaseAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));

vi.mock("@/lib/security/security-events", () => ({
  recordSecurityEvent,
}));

vi.mock("@/lib/security/rate-limit", () => ({
  requestAddress: () => "203.0.113.50",
}));

function payload(overrides: Partial<SessionBridgePayload> = {}): SessionBridgePayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: "user-1",
    role: "USER",
    emailConfirmed: true,
    mfaSatisfied: false,
    aal: "aal1",
    iat: now,
    exp: now + 900,
    ...overrides,
  };
}

function request(path: string, cookie?: string) {
  return new NextRequest(new URL(`http://localhost${path}`), {
    headers: cookie ? { cookie: `${SESSION_BRIDGE_COOKIE}=${cookie}` } : undefined,
  });
}

describe("session bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SESSION_BRIDGE_SECRET = "test-session-bridge-secret";
    getUser.mockResolvedValue({
      data: { user: { id: "user-1", email_confirmed_at: "2026-08-23T10:00:00Z" } },
      error: null,
    });
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1" }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: "USER" }, error: null });
    recordSecurityEvent.mockResolvedValue({ ok: true });
  });

  it("signs and verifies a valid auxiliary session cookie", async () => {
    const signed = await signSessionBridgePayload(payload());
    const verified = await verifySessionBridgeCookie(signed);

    expect(verified.valid).toBe(true);
    if (verified.valid) {
      expect(verified.payload.sub).toBe("user-1");
      expect(verified.payload.role).toBe("USER");
    }
  });

  it("rejects expired auxiliary session cookies", async () => {
    const signed = await signSessionBridgePayload(payload({ exp: Math.floor(Date.now() / 1000) - 1 }));

    await expect(verifySessionBridgeCookie(signed)).resolves.toEqual({ valid: false, reason: "EXPIRED" });
  });

  it("redirects private routes without a cookie", async () => {
    const { middleware } = await import("@/middleware");
    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("allows private routes with a valid cookie", async () => {
    const { middleware } = await import("@/middleware");
    const signed = await signSessionBridgePayload(payload());
    const response = await middleware(request("/dashboard", signed));

    expect(response.status).toBe(200);
  });

  it("requires ADMIN role for admin navigation", async () => {
    const { middleware } = await import("@/middleware");
    const signed = await signSessionBridgePayload(payload({ role: "USER" }));
    const response = await middleware(request("/admin", signed));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/dashboard");
  });

  it("requires MFA for admin navigation", async () => {
    const { middleware } = await import("@/middleware");
    const signed = await signSessionBridgePayload(payload({ role: "ADMIN", mfaSatisfied: false }));
    const response = await middleware(request("/admin", signed));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/mfa/setup");
  });

  it("allows admin navigation after MFA", async () => {
    const { middleware } = await import("@/middleware");
    const signed = await signSessionBridgePayload(payload({ role: "ADMIN", mfaSatisfied: true, aal: "aal2" }));
    const response = await middleware(request("/admin", signed));

    expect(response.status).toBe(200);
  });

  it("creates the auxiliary cookie after validating a Supabase session", async () => {
    const { POST } = await import("@/app/api/auth/session/route");
    const response = await POST(new Request("http://localhost/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: "header.eyJleHAiOjk5OTk5OTk5OTl9.signature" }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(SESSION_BRIDGE_COOKIE);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).not.toContain("header.eyJleHAiOjk5OTk5OTk5OTl9.signature");
  });

  it("creates an AAL2 auxiliary cookie after MFA verification", async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal2" }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: "ADMIN" }, error: null });
    const { POST } = await import("@/app/api/auth/session/route");
    const response = await POST(new Request("http://localhost/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: "header.eyJleHAiOjk5OTk5OTk5OTl9.signature" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.role).toBe("ADMIN");
    expect(body.mfaSatisfied).toBe(true);
    expect(response.headers.get("set-cookie")).toContain(SESSION_BRIDGE_COOKIE);
  });

  it("reports the current auxiliary session bridge state", async () => {
    const { GET } = await import("@/app/api/auth/session/route");
    const signed = await signSessionBridgePayload(payload({ role: "ADMIN", mfaSatisfied: true, aal: "aal2" }));
    const response = await GET(new Request("http://localhost/api/auth/session", {
      headers: { cookie: `${SESSION_BRIDGE_COOKIE}=${encodeURIComponent(signed)}` },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.authenticated).toBe(true);
    expect(body.role).toBe("ADMIN");
    expect(body.mfaSatisfied).toBe(true);
    expect(body.aal).toBe("aal2");
  });

  it("rejects session bridge status checks without a valid auxiliary cookie", async () => {
    const { GET } = await import("@/app/api/auth/session/route");
    const response = await GET(new Request("http://localhost/api/auth/session"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.authenticated).toBe(false);
  });

  it("clears the auxiliary cookie on logout and records LOGOUT without secrets", async () => {
    const { DELETE } = await import("@/app/api/auth/session/route");
    const response = await DELETE(new Request("http://localhost/api/auth/session", {
      method: "DELETE",
      headers: { Authorization: "Bearer secret-access-token", "User-Agent": "Vitest" },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_BRIDGE_COOKIE}=`);
    expect(recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "LOGOUT", success: true }));
    expect(JSON.stringify(recordSecurityEvent.mock.calls)).not.toContain("secret-access-token");
  });
});

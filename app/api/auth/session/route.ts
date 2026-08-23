import { NextResponse } from "next/server";
import { getUserRole, isAdminRole } from "@/lib/admin";
import { requestAddress } from "@/lib/security/rate-limit";
import { recordSecurityEvent } from "@/lib/security/security-events";
import {
  SESSION_BRIDGE_COOKIE,
  SESSION_BRIDGE_MAX_AGE_SECONDS,
  sessionBridgeCookieOptions,
  signSessionBridgePayload,
  type SessionBridgeRole,
} from "@/lib/security/session-bridge";
import { createSupabaseAdminClient, createSupabaseAuthServerClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";

function bearerToken(request: Request) {
  const [type, token] = (request.headers.get("authorization") || "").split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

function decodeJwtExp(accessToken: string) {
  try {
    const [, payload] = accessToken.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const parsed = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof parsed.exp === "number" ? parsed.exp : null;
  } catch {
    return null;
  }
}

async function resolveRole(userId: string): Promise<SessionBridgeRole> {
  if (!isSupabaseAdminConfigured) return "USER";
  const adminClient = createSupabaseAdminClient();
  const { data } = await adminClient.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  return isAdminRole(getUserRole(data?.role)) ? "ADMIN" : "USER";
}

async function resolveAal(accessToken: string) {
  const authClient = createSupabaseAuthServerClient(accessToken);
  const { data } = await authClient.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    currentLevel: data?.currentLevel || "aal1",
    mfaSatisfied: data?.currentLevel === "aal2",
  };
}

function clearCookie(response: NextResponse) {
  response.cookies.set(SESSION_BRIDGE_COOKIE, "", sessionBridgeCookieOptions(0));
  return response;
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: "Supabase server não configurado." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const accessToken = typeof body.access_token === "string" ? body.access_token : bearerToken(request);
  if (!accessToken) {
    return clearCookie(NextResponse.json({ error: "Sessão ausente." }, { status: 401 }));
  }

  const authClient = createSupabaseAuthServerClient(accessToken);
  const { data, error } = await authClient.auth.getUser(accessToken);
  const user = data.user;
  if (error || !user) {
    return clearCookie(NextResponse.json({ error: "Sessão inválida." }, { status: 401 }));
  }

  if (!user.email_confirmed_at) {
    return clearCookie(NextResponse.json({ error: "E-mail não confirmado." }, { status: 403 }));
  }

  const now = Math.floor(Date.now() / 1000);
  const tokenExp = decodeJwtExp(accessToken);
  const exp = Math.min(tokenExp || now + SESSION_BRIDGE_MAX_AGE_SECONDS, now + SESSION_BRIDGE_MAX_AGE_SECONDS);
  const role = await resolveRole(user.id);
  const aal = await resolveAal(accessToken);
  const signedCookie = await signSessionBridgePayload({
    sub: user.id,
    role,
    emailConfirmed: true,
    mfaSatisfied: aal.mfaSatisfied,
    aal: aal.currentLevel,
    iat: now,
    exp,
  });

  const response = NextResponse.json({
    ok: true,
    role,
    mfaSatisfied: aal.mfaSatisfied,
    expiresAt: new Date(exp * 1000).toISOString(),
  });
  response.cookies.set(SESSION_BRIDGE_COOKIE, signedCookie, sessionBridgeCookieOptions(Math.max(0, exp - now)));
  return response;
}

export async function DELETE(request: Request) {
  const token = bearerToken(request);
  if (token && isSupabaseServerConfigured) {
    const authClient = createSupabaseAuthServerClient(token);
    const { data } = await authClient.auth.getUser(token).catch(() => ({ data: { user: null } }));
    await recordSecurityEvent({
      eventType: "LOGOUT",
      success: true,
      userId: data.user?.id || null,
      ip: requestAddress(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { source: "session_bridge" },
    });
  }

  return clearCookie(NextResponse.json({ ok: true }));
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { recordSecurityEvent, type SecurityEventType } from "@/lib/security/security-events";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";

const ALLOWED_MFA_EVENTS = new Set<SecurityEventType>([
  "MFA_SETUP_STARTED",
  "MFA_SETUP_FAILED",
  "MFA_ENABLED",
  "MFA_CHALLENGE_REQUESTED",
  "MFA_SUCCESS",
  "MFA_FAILED",
  "MFA_DISABLED",
]);

function safeReason(value: unknown) {
  return typeof value === "string" ? value.slice(0, 80) : "UNSPECIFIED";
}

export async function POST(request: Request) {
  const adminAuth = await requireAdmin(request);
  if ("response" in adminAuth) return adminAuth.response;

  const body = await request.json().catch(() => ({}));
  const eventType = String(body.eventType || "") as SecurityEventType;
  if (!ALLOWED_MFA_EVENTS.has(eventType)) {
    return NextResponse.json({ error: "Evento MFA inválido." }, { status: 400 });
  }

  if (eventType === "MFA_ENABLED" || eventType === "MFA_SUCCESS") {
    const authClient = createSupabaseAuthServerClient(adminAuth.token);
    const { data, error } = await authClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || data.currentLevel !== "aal2") {
      await recordSecurityEvent({
        eventType: "MFA_FAILED",
        success: false,
        userId: adminAuth.user.id,
        metadata: { reason: "BACKEND_AAL2_CONFIRMATION_FAILED", currentLevel: data?.currentLevel || null },
      });
      return NextResponse.json({ error: "MFA ainda não confirmado." }, { status: 409 });
    }
  }

  await recordSecurityEvent({
    eventType,
    success: !eventType.endsWith("_FAILED"),
    userId: adminAuth.user.id,
    ip: request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    userAgent: request.headers.get("user-agent"),
    metadata: {
      reason: safeReason(body.reason),
      factorType: body.factorType === "totp" ? "totp" : undefined,
      confirmedByBackend: true,
    },
  });

  return NextResponse.json({ ok: true });
}

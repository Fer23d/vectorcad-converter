import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { recordSecurityEvent } from "@/lib/security/security-events";

function verifiedTotpCount(factors: unknown) {
  if (!Array.isArray(factors)) return 0;
  return factors.filter((factor) => {
    if (!factor || typeof factor !== "object") return false;
    const row = factor as { factor_type?: unknown; status?: unknown };
    return row.factor_type === "totp" && row.status === "verified";
  }).length;
}

export async function GET(request: Request) {
  const adminAuth = await requireAdmin(request);
  if ("response" in adminAuth) return adminAuth.response;

  const authClient = createSupabaseAuthServerClient(adminAuth.token);
  const [aalResult, factorResult] = await Promise.all([
    authClient.auth.mfa.getAuthenticatorAssuranceLevel(adminAuth.token),
    authClient.auth.mfa.listFactors(),
  ]);

  if (aalResult.error || factorResult.error) {
    return NextResponse.json({ error: "Não foi possível validar MFA." }, { status: 500 });
  }

  const factors = factorResult.data?.all || [];
  const verifiedFactors = verifiedTotpCount(factors);
  const currentLevel = aalResult.data.currentLevel || "aal1";
  const nextLevel = aalResult.data.nextLevel || null;
  const mfaRequired = currentLevel !== "aal2";
  const setupRequired = verifiedFactors === 0;

  if (mfaRequired) {
    await recordSecurityEvent({
      eventType: "MFA_REQUIRED",
      success: false,
      userId: adminAuth.user.id,
      metadata: { reason: setupRequired ? "SETUP_REQUIRED" : "CHALLENGE_REQUIRED", currentLevel, nextLevel, verifiedFactors },
    });
  }

  return NextResponse.json({
    isAdmin: true,
    role: adminAuth.role,
    currentLevel,
    nextLevel,
    verifiedFactors,
    setupRequired,
    challengeRequired: !setupRequired && mfaRequired,
    mfaSatisfied: currentLevel === "aal2",
  });
}

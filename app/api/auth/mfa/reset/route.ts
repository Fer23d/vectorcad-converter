import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { requestAddress } from "@/lib/security/rate-limit";
import { recordSecurityEvent } from "@/lib/security/security-events";

type MfaAdminFactor = {
  id?: string;
  factor_type?: string;
  status?: string;
};

type OwnTotpFactor = {
  id: string;
  factor_type: "totp";
  status?: string;
};

function safeReason(value: unknown) {
  return typeof value === "string" ? value.slice(0, 80) : "UNSPECIFIED";
}

function ownTotpFactors(factors: unknown): OwnTotpFactor[] {
  if (!Array.isArray(factors)) return [];
  return factors.filter((factor): factor is OwnTotpFactor => {
    if (!factor || typeof factor !== "object") return false;
    const row = factor as MfaAdminFactor;
    return typeof row.id === "string" && row.factor_type === "totp";
  });
}

export async function POST(request: Request) {
  const adminAuth = await requireAdmin(request);
  if ("response" in adminAuth) return adminAuth.response;

  const body = await request.json().catch(() => ({}));
  const requestedFactorId = typeof body.factorId === "string" ? body.factorId.trim() : "";

  const { data, error } = await adminAuth.adminClient.auth.admin.mfa.listFactors({
    userId: adminAuth.user.id,
  });

  if (error) {
    await recordSecurityEvent({
      eventType: "MFA_RESET",
      success: false,
      userId: adminAuth.user.id,
      ip: requestAddress(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { reason: "LIST_FACTORS_FAILED", code: safeReason(error.name || error.message) },
    });
    return NextResponse.json({ error: "Não foi possível validar os fatores MFA." }, { status: 500 });
  }

  const totpFactors = ownTotpFactors(data?.factors);
  const factorsToRemove = requestedFactorId
    ? totpFactors.filter((factor) => factor.id === requestedFactorId)
    : totpFactors;

  if (factorsToRemove.length === 0) {
    await recordSecurityEvent({
      eventType: "MFA_RESET",
      success: false,
      userId: adminAuth.user.id,
      ip: requestAddress(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { reason: requestedFactorId ? "TOTP_FACTOR_NOT_FOUND" : "NO_TOTP_FACTOR" },
    });
    return NextResponse.json({ error: "Nenhum fator TOTP elegível para redefinição foi encontrado." }, { status: 404 });
  }

  for (const factor of factorsToRemove) {
    const deleteResult = await adminAuth.adminClient.auth.admin.mfa.deleteFactor({
      userId: adminAuth.user.id,
      id: factor.id,
    });

    if (deleteResult.error) {
      await recordSecurityEvent({
        eventType: "MFA_RESET",
        success: false,
        userId: adminAuth.user.id,
        ip: requestAddress(request),
        userAgent: request.headers.get("user-agent"),
        metadata: { reason: "DELETE_FACTOR_FAILED", code: safeReason(deleteResult.error.name || deleteResult.error.message) },
      });
      return NextResponse.json({ error: "Não foi possível redefinir o MFA administrativo." }, { status: 500 });
    }
  }

  await recordSecurityEvent({
    eventType: "MFA_RESET",
    success: true,
    userId: adminAuth.user.id,
    ip: requestAddress(request),
    userAgent: request.headers.get("user-agent"),
    metadata: {
      factorType: "totp",
      removedFactors: factorsToRemove.length,
    },
  });

  return NextResponse.json({ ok: true, removedFactors: factorsToRemove.length });
}

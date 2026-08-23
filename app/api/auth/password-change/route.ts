import { NextResponse } from "next/server";
import { consumeRateLimit, requestAddress } from "@/lib/security/rate-limit";
import { recordSecurityEvent } from "@/lib/security/security-events";
import { createSupabaseAuthServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server";

const MIN_PASSWORD_LENGTH = 8;
const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "password",
  "password1",
  "qwerty123",
  "admin123",
  "vetorcad",
  "vectorcad",
]);

const GENERIC_CHANGE_ERROR = "Não foi possível atualizar a senha. Solicite um novo link e tente novamente.";
const BLOCKED_CHANGE_ERROR = "Muitas tentativas de alteração de senha. Aguarde alguns minutos antes de tentar novamente.";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function passwordPolicyError(password: string, confirmPassword: string) {
  if (password.length < MIN_PASSWORD_LENGTH) return "A nova senha precisa ter pelo menos 8 caracteres.";
  if (password !== confirmPassword) return "As senhas não conferem.";
  if (COMMON_PASSWORDS.has(password.trim().toLowerCase())) return "Escolha uma senha menos comum.";
  return null;
}

async function recordChangeBlocked(request: Request, reason: string, userId?: string | null) {
  await recordSecurityEvent({
    eventType: "PASSWORD_CHANGE_BLOCKED",
    success: false,
    userId,
    ip: requestAddress(request),
    userAgent: request.headers.get("user-agent"),
    metadata: { reason },
  });
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
  }

  const ip = requestAddress(request);
  const ipLimit = await consumeRateLimit(`auth:password-change:ip:${ip}`, 10, 10 * 60 * 1000, { failureMode: "closed" });
  if (!ipLimit.allowed) {
    await recordChangeBlocked(request, "IP_RATE_LIMIT");
    return NextResponse.json({ error: BLOCKED_CHANGE_ERROR }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const password = String(body.password || "");
  const confirmPassword = String(body.confirmPassword || "");
  const policyError = passwordPolicyError(password, confirmPassword);
  if (policyError) {
    await recordChangeBlocked(request, "PASSWORD_POLICY");
    return NextResponse.json({ error: policyError }, { status: 400 });
  }

  const token = bearerToken(request);
  if (!token) {
    await recordChangeBlocked(request, "MISSING_SESSION");
    return NextResponse.json({ error: GENERIC_CHANGE_ERROR }, { status: 401 });
  }

  const authClient = createSupabaseAuthServerClient(token);
  const { data: userData, error: userError } = await authClient.auth.getUser();
  const userId = userData.user?.id || null;
  if (userError || !userId) {
    await recordChangeBlocked(request, "INVALID_SESSION");
    return NextResponse.json({ error: GENERIC_CHANGE_ERROR }, { status: 401 });
  }

  const userLimit = await consumeRateLimit(`auth:password-change:user:${userId}`, 5, 10 * 60 * 1000, { failureMode: "closed" });
  if (!userLimit.allowed) {
    await recordChangeBlocked(request, "USER_RATE_LIMIT", userId);
    return NextResponse.json({ error: BLOCKED_CHANGE_ERROR }, { status: 429 });
  }

  const { error } = await authClient.auth.updateUser({ password });
  if (error) {
    await recordChangeBlocked(request, "SUPABASE_PASSWORD_UPDATE_FAILED", userId);
    return NextResponse.json({ error: GENERIC_CHANGE_ERROR }, { status: 400 });
  }

  await recordSecurityEvent({
    eventType: "PASSWORD_CHANGED",
    success: true,
    userId,
    ip,
    userAgent: request.headers.get("user-agent"),
    metadata: { currentSessionSignOutRequired: true, globalRevocationPrepared: true },
  });

  return NextResponse.json({ ok: true, signOutCurrentSession: true });
}

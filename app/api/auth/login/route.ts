import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { normalizeEmail } from "@/lib/auth/email-domain";
import { consumeRateLimit, requestAddress, type RateLimitDecision } from "@/lib/security/rate-limit";
import { recordSecurityEvent } from "@/lib/security/security-events";
import { createSupabaseAuthServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server";

const GENERIC_LOGIN_ERROR = "Não foi possível entrar. Verifique os dados e tente novamente.";
const LOCKED_LOGIN_ERROR = "Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.";
const EMAIL_NOT_CONFIRMED_ERROR = "Confirme seu e-mail para acessar o VetorCAD.";

const IP_ATTEMPT_LIMIT = 10;
const IP_ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const EMAIL_FAILURE_LIMIT = 5;
const EMAIL_FAILURE_WINDOW_MS = 10 * 60 * 1000;
const PAIR_ATTEMPT_LIMIT = 5;
const PAIR_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

const LOCK_DURATIONS_MS = [15 * 60 * 1000, 60 * 60 * 1000, 24 * 60 * 60 * 1000] as const;
const LOCK_OFFENSE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function safeKeyPart(value: string) {
  return encodeURIComponent(value.trim().toLowerCase()).replace(/%/g, "_");
}

function loginKeys(ip: string, email: string) {
  const safeIp = safeKeyPart(ip || "unknown");
  const safeEmail = safeKeyPart(email || "unknown");
  return {
    ip: `auth:login:ip:${safeIp}`,
    email: `auth:login:email:${safeEmail}`,
    pair: `auth:login:pair:${safeIp}:${safeEmail}`,
    ipLock: `auth:login:lock:ip:${safeIp}`,
    emailLock: `auth:login:lock:email:${safeEmail}`,
    pairLock: `auth:login:lock:pair:${safeIp}:${safeEmail}`,
    ipOffense: `auth:login:offense:ip:${safeIp}`,
    emailOffense: `auth:login:offense:email:${safeEmail}`,
    pairOffense: `auth:login:offense:pair:${safeIp}:${safeEmail}`,
  };
}

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

async function redisPipeline(commands: unknown[][]) {
  const config = redisConfig();
  if (!config) return null;
  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("AUTH_LOCK_STORE_UNAVAILABLE");
  return await response.json() as Array<{ result?: unknown }>;
}

async function hasActiveLock(keys: ReturnType<typeof loginKeys>) {
  const result = await redisPipeline([["GET", keys.ipLock], ["GET", keys.emailLock], ["GET", keys.pairLock]]).catch(() => null);
  if (!result) return false;
  return result.some((item) => Boolean(item.result));
}

async function createProgressiveLock(lockKey: string, offenseKey: string) {
  const offenseResult = await redisPipeline([
    ["INCR", offenseKey],
    ["PEXPIRE", offenseKey, LOCK_OFFENSE_WINDOW_MS, "NX"],
  ]).catch(() => null);
  const offenseCount = Number(offenseResult?.[0]?.result || 1);
  const lockDuration = LOCK_DURATIONS_MS[Math.min(Math.max(0, offenseCount - 1), LOCK_DURATIONS_MS.length - 1)];
  await redisPipeline([["SET", lockKey, String(Date.now() + lockDuration), "PX", lockDuration]]).catch(() => null);
  return lockDuration;
}

async function recordLoginFailure(request: Request, email: string, reason: string, locked = false) {
  await recordSecurityEvent({
    eventType: locked ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
    success: false,
    ip: requestAddress(request),
    userAgent: request.headers.get("user-agent"),
    metadata: { reason, emailHash: await hashIdentifier(email) },
  });
}

async function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function loginBlocked(decisions: RateLimitDecision[]) {
  return decisions.find((decision) => !decision.allowed);
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email || ""));
  const password = String(body.password || "");
  const ip = requestAddress(request);
  const userAgent = request.headers.get("user-agent");
  const keys = loginKeys(ip, email);

  if (!email || !email.includes("@") || password.length < 6) {
    await recordLoginFailure(request, email || "invalid", "INVALID_INPUT");
    return NextResponse.json({ error: GENERIC_LOGIN_ERROR }, { status: 400 });
  }

  if (await hasActiveLock(keys)) {
    await recordLoginFailure(request, email, "ACTIVE_LOCK", true);
    return NextResponse.json({ error: LOCKED_LOGIN_ERROR }, { status: 429 });
  }

  const ipLimit = await consumeRateLimit(keys.ip, IP_ATTEMPT_LIMIT, IP_ATTEMPT_WINDOW_MS, { failureMode: "closed" });
  const pairLimit = await consumeRateLimit(keys.pair, PAIR_ATTEMPT_LIMIT, PAIR_ATTEMPT_WINDOW_MS, { failureMode: "closed" });
  const blockedAttempt = loginBlocked([ipLimit, pairLimit]);
  if (blockedAttempt) {
    const target = !ipLimit.allowed ? "IP_LIMIT" : "PAIR_LIMIT";
    await createProgressiveLock(!ipLimit.allowed ? keys.ipLock : keys.pairLock, !ipLimit.allowed ? keys.ipOffense : keys.pairOffense);
    await recordLoginFailure(request, email, target, true);
    return NextResponse.json({ error: LOCKED_LOGIN_ERROR }, { status: 429 });
  }

  const authClient = createSupabaseAuthServerClient();
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
    const emailLimit = await consumeRateLimit(keys.email, EMAIL_FAILURE_LIMIT, EMAIL_FAILURE_WINDOW_MS, { failureMode: "closed" });
    if (!emailLimit.allowed) {
      await createProgressiveLock(keys.emailLock, keys.emailOffense);
      await recordLoginFailure(request, email, "EMAIL_FAILURE_LIMIT", true);
      return NextResponse.json({ error: LOCKED_LOGIN_ERROR }, { status: 429 });
    }

    const reason = error?.message?.toLowerCase().includes("email not confirmed") ? "EMAIL_NOT_CONFIRMED" : "INVALID_CREDENTIALS";
    await recordLoginFailure(request, email, reason);
    if (reason === "EMAIL_NOT_CONFIRMED") {
      return NextResponse.json({ error: EMAIL_NOT_CONFIRMED_ERROR, code: "EMAIL_NOT_CONFIRMED" }, { status: 403 });
    }
    return NextResponse.json({ error: GENERIC_LOGIN_ERROR }, { status: 401 });
  }

  await recordSecurityEvent({
    eventType: "LOGIN_SUCCESS",
    success: true,
    userId: data.user.id,
    ip,
    userAgent,
    metadata: { emailHash: await hashIdentifier(email) },
  });

  return NextResponse.json({
    ok: true,
    user: { id: data.user.id, email: data.user.email, email_confirmed_at: data.user.email_confirmed_at },
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
}

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { sendPasswordResetEmail } from "@/lib/resend";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/server";
import { consumeRateLimit, requestAddress } from "@/lib/security/rate-limit";
import { secureLogger } from "@/lib/security/logger";
import { recordSecurityEvent } from "@/lib/security/security-events";

const PASSWORD_RESET_REDIRECT_TO = "https://vetorcad.com.br/reset-password";
const GENERIC_RESET_MESSAGE = "Se esse e-mail estiver cadastrado, enviaremos um link de recuperação.";
const RESET_RATE_LIMIT_MESSAGE = "Muitas solicitações. Aguarde alguns minutos antes de tentar novamente.";

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function userDisplayName(metadata: Record<string, unknown> | undefined) {
  const firstName = String(metadata?.first_name || "").trim();
  const lastName = String(metadata?.last_name || "").trim();
  return [firstName, lastName].filter(Boolean).join(" ");
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain || "***"}`;
}

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function recoveryLinkSummary(actionLink: string) {
  try {
    const parsedUrl = new URL(actionLink);
    const redirectTo = parsedUrl.searchParams.get("redirect_to") || parsedUrl.searchParams.get("redirectTo");
    const redirectUrl = redirectTo ? new URL(redirectTo) : null;
    return {
      generatedLinkHostname: parsedUrl.hostname,
      generatedLinkPathname: parsedUrl.pathname,
      redirectPathname: redirectUrl?.pathname || null,
      linkType: parsedUrl.searchParams.get("type") || "recovery",
      hasToken: parsedUrl.searchParams.has("token"),
      hasTokenHash: parsedUrl.searchParams.has("token_hash"),
      hasCode: parsedUrl.searchParams.has("code"),
      hasAccessToken: parsedUrl.searchParams.has("access_token"),
      hasRefreshToken: parsedUrl.searchParams.has("refresh_token"),
    };
  } catch {
    return {
      generatedLinkHostname: "invalid_url",
      generatedLinkPathname: null,
      redirectPathname: null,
      redirectTo: null,
      linkType: "recovery",
      hasToken: false,
      hasTokenHash: false,
      hasCode: false,
      hasAccessToken: false,
      hasRefreshToken: false,
    };
  }
}

async function recordResetEvent(request: Request, email: string, success: boolean, reason: string) {
  await recordSecurityEvent({
    eventType: success ? "PASSWORD_RESET_REQUESTED" : "PASSWORD_RESET_FAILED",
    success,
    ip: requestAddress(request),
    userAgent: request.headers.get("user-agent"),
    metadata: { reason, emailHash: hashIdentifier(email) },
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    secureLogger.error("[password-reset] Supabase admin is not configured", {
      hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    });
    return NextResponse.json({ error: "Configure SUPABASE_SERVICE_ROLE_KEY para gerar link seguro." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body.email);
  if (!email || !email.includes("@")) {
    await recordResetEvent(request, email || "invalid", false, "INVALID_INPUT");
    return NextResponse.json({ ok: true, message: GENERIC_RESET_MESSAGE });
  }

  const emailLimit = await consumeRateLimit(`auth:password-reset:email:${encodeURIComponent(email)}`, 3, 60 * 60 * 1000, { failureMode: "closed" });
  const ipLimit = await consumeRateLimit(`auth:password-reset:ip:${requestAddress(request)}`, 10, 60 * 60 * 1000, { failureMode: "closed" });
  if (!emailLimit.allowed || !ipLimit.allowed) {
    await recordResetEvent(request, email, false, !emailLimit.allowed ? "EMAIL_RATE_LIMIT" : "IP_RATE_LIMIT");
    return NextResponse.json({ error: RESET_RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const redirectTo = PASSWORD_RESET_REDIRECT_TO;
  const adminClient = createSupabaseAdminClient();
  secureLogger.info("[password-reset] request received", { email: maskEmail(email), redirectPathname: "/reset-password" });

  // Supabase resetPasswordForEmail sends through Supabase mailer. For Resend branding,
  // we generate the secure recovery link server-side and deliver it with Resend.
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (error || !data.properties?.action_link) {
    secureLogger.error("[password-reset] failed to generate Supabase recovery link", {
      email: maskEmail(email),
      code: error?.code || "missing_action_link",
    });
    await recordResetEvent(request, email, false, error?.code || "SUPABASE_RECOVERY_LINK_FAILED");
    return NextResponse.json({ ok: true, message: GENERIC_RESET_MESSAGE });
  }

  secureLogger.info("[password-reset] Supabase recovery link generated", recoveryLinkSummary(data.properties.action_link));

  try {
    await sendPasswordResetEmail({
      to: email,
      name: userDisplayName(data.user?.user_metadata as Record<string, unknown> | undefined),
      resetUrl: data.properties.action_link,
    });

    secureLogger.info("[password-reset] recovery email sent", { email: maskEmail(email) });
    await recordResetEvent(request, email, true, "REQUEST_ACCEPTED");
    return NextResponse.json({ ok: true, message: GENERIC_RESET_MESSAGE });
  } catch (sendError) {
    secureLogger.error("[password-reset] failed to send Resend email", {
      email: maskEmail(email),
      code: sendError instanceof Error ? sendError.name : "unknown_error",
    });
    await recordResetEvent(request, email, false, "RESEND_SEND_FAILED");
    return NextResponse.json({ ok: true, message: GENERIC_RESET_MESSAGE });
  }
}

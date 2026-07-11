import { NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/resend";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/server";

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

function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "") || "";
}

function siteUrl() {
  const configuredUrl =
    cleanEnv(process.env.NEXT_PUBLIC_SITE_URL) ||
    cleanEnv(process.env.NEXT_PUBLIC_APP_URL) ||
    "https://vetorcad.com.br";

  try {
    const parsedUrl = new URL(configuredUrl);
    if (parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1") {
      console.warn("[password-reset] ignoring local site URL for production reset link");
      return "https://vetorcad.com.br";
    }

    return parsedUrl.origin;
  } catch {
    console.warn("[password-reset] invalid site URL configured, using production domain");
    return "https://vetorcad.com.br";
  }
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    console.error("[password-reset] Supabase admin is not configured", {
      hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    });
    return NextResponse.json({ error: "Configure SUPABASE_SERVICE_ROLE_KEY para gerar link seguro." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body.email);
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Informe um email valido." }, { status: 400 });
  }

  const redirectTo = `${siteUrl()}/reset-password`;
  const adminClient = createSupabaseAdminClient();
  console.info("[password-reset] request received", { email: maskEmail(email), redirectTo });

  // Supabase resetPasswordForEmail sends through Supabase mailer. For Resend branding,
  // we generate the secure recovery link server-side and deliver it with Resend.
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (error || !data.properties?.action_link) {
    console.error("[password-reset] failed to generate Supabase recovery link", {
      email: maskEmail(email),
      message: error?.message || "missing_action_link",
    });
    return NextResponse.json({ error: error?.message || "Nao foi possivel gerar link de recuperacao." }, { status: 500 });
  }

  try {
    await sendPasswordResetEmail({
      to: email,
      name: userDisplayName(data.user?.user_metadata as Record<string, unknown> | undefined),
      resetUrl: data.properties.action_link,
    });

    console.info("[password-reset] recovery email sent", { email: maskEmail(email) });
    return NextResponse.json({ ok: true });
  } catch (sendError) {
    console.error("[password-reset] failed to send Resend email", {
      email: maskEmail(email),
      message: sendError instanceof Error ? sendError.message : "unknown_error",
    });
    return NextResponse.json({ error: sendError instanceof Error ? sendError.message : "Nao foi possivel enviar email." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { normalizeCompany } from "@/lib/access-control";
import { isTemporaryEmail, normalizeEmail, temporaryEmailMessage } from "@/lib/auth/email-domain";
import { getAppUrl, sendEmailConfirmationEmail } from "@/lib/resend";
import { createSupabaseAdminClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS_PER_EMAIL = 3;
const MAX_ATTEMPTS_PER_IP = 12;
const attemptsByEmail = new Map<string, { count: number; resetAt: number }>();
const attemptsByIp = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function bumpLimit(store: Map<string, { count: number; resetAt: number }>, key: string, limit: number) {
  const now = Date.now();
  const current = store.get(key);
  if (!current || current.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  current.count += 1;
  store.set(key, current);
  return current.count > limit;
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured || !isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase Admin não configurado." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const firstName = String(body.first_name || "").trim();
  const lastName = String(body.last_name || "").trim();
  const company = normalizeCompany(typeof body.company === "string" ? body.company : null);
  const email = normalizeEmail(String(body.email || ""));
  const password = String(body.password || "");
  const acceptedTerms = body.terms_accepted === true;
  const acceptedAt = typeof body.terms_accepted_at === "string" ? body.terms_accepted_at : new Date().toISOString();

  if (!firstName || !lastName || !email || password.length < 6) {
    return NextResponse.json({ error: "Preencha nome, sobrenome, e-mail e uma senha com pelo menos 6 caracteres." }, { status: 400 });
  }

  if (!acceptedTerms) {
    return NextResponse.json({ error: "Você precisa aceitar os Termos de Uso e a Política de Privacidade para criar sua conta." }, { status: 400 });
  }

  if (isTemporaryEmail(email)) {
    return NextResponse.json({ error: temporaryEmailMessage() }, { status: 400 });
  }

  if (bumpLimit(attemptsByEmail, email, MAX_ATTEMPTS_PER_EMAIL) || bumpLimit(attemptsByIp, clientIp(request), MAX_ATTEMPTS_PER_IP)) {
    return NextResponse.json({ error: "Muitas tentativas de cadastro. Aguarde alguns minutos antes de tentar novamente." }, { status: 429 });
  }

  const adminClient = createSupabaseAdminClient();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const redirectTo = getAppUrl("/verify-email");
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: {
      redirectTo,
      data: {
        first_name: firstName,
        last_name: lastName,
        company,
        terms_accepted: true,
        terms_accepted_at: acceptedAt,
        terms_version: "1.0",
      },
    },
  });

  if (error || !data.properties?.action_link) {
    const message = error?.message?.toLowerCase().includes("already") ? "Esse e-mail já existe. Tente fazer login." : error?.message || "Não foi possível criar a conta.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await sendEmailConfirmationEmail({
    to: email,
    name: fullName,
    confirmUrl: data.properties.action_link,
  });

  return NextResponse.json({
    ok: true,
    email,
    message: "Conta criada. Enviamos um link de confirmação para o seu e-mail.",
  });
}

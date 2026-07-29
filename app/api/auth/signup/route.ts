import { NextResponse } from "next/server";
import { normalizeCompany } from "@/lib/access-control";
import { isTemporaryEmail, normalizeEmail, temporaryEmailMessage } from "@/lib/auth/email-domain";
import { getAppUrl, sendEmailConfirmationEmail } from "@/lib/resend";
import { createSupabaseAdminClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { consumeRateLimit, requestAddress } from "@/lib/security/rate-limit";

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

  const emailLimit = await consumeRateLimit(`signup:email:${email}`, 3, 60 * 60 * 1000);
  const ipLimit = await consumeRateLimit(`signup:ip:${requestAddress(request)}`, 12, 60 * 60 * 1000);
  if (!emailLimit.allowed || !ipLimit.allowed) {
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

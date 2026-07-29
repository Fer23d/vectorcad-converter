import { NextResponse } from "next/server";
import { isTemporaryEmail, normalizeEmail, temporaryEmailMessage } from "@/lib/auth/email-domain";
import { getAppUrl } from "@/lib/resend";
import { createSupabaseAuthServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { consumeRateLimit, requestAddress } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email || ""));
  if (!email) {
    return NextResponse.json({ error: "Informe o e-mail usado no cadastro." }, { status: 400 });
  }

  if (isTemporaryEmail(email)) {
    return NextResponse.json({ error: temporaryEmailMessage() }, { status: 400 });
  }

  const emailLimit = await consumeRateLimit(`resend:email:${email}`, 3, 60 * 60 * 1000);
  const ipLimit = await consumeRateLimit(`resend:ip:${requestAddress(request)}`, 10, 60 * 60 * 1000);
  if (!emailLimit.allowed || !ipLimit.allowed) return NextResponse.json({ error: "Muitas solicitações. Aguarde antes de tentar novamente." }, { status: 429 });

  const authClient = createSupabaseAuthServerClient();
  const { error } = await authClient.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: getAppUrl("/verify-email") },
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Não foi possível reenviar o e-mail de confirmação." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Enviamos um novo link de confirmação para o seu e-mail." });
}

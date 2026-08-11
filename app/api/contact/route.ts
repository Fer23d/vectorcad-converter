import { NextResponse } from "next/server";
import { sendContactEmail } from "@/lib/resend";
import { consumeRateLimit, requestAddress } from "@/lib/security/rate-limit";

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, maxLength) : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = normalizeText(body?.name, 120);
  const email = normalizeText(body?.email, 254).toLowerCase();
  const message = normalizeText(body?.message, 5000);
  const company = normalizeText(body?.company, 160);
  const subject = normalizeText(body?.subject, 80) || "Dúvidas gerais";
  const honeypot = normalizeText(body?.website, 200);

  if (honeypot) return NextResponse.json({ ok: true });
  if (!name || !email || !message) return NextResponse.json({ error: "Preencha nome, e-mail e mensagem." }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "Informe um endereço de e-mail válido." }, { status: 400 });
  if (message.length < 3) return NextResponse.json({ error: "Escreva uma mensagem com pelo menos 3 caracteres." }, { status: 400 });
  const limit = await consumeRateLimit(`contact:ip:${requestAddress(request)}`, 5, 10 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "Muitas mensagens enviadas. Aguarde alguns minutos e tente novamente." }, { status: 429 });

  try {
    const result = await sendContactEmail({ name, email, message: `Assunto: ${subject}\nEmpresa: ${company || "Não informado"}\n\n${message}` });
    return NextResponse.json({ ok: true, id: result?.id });
  } catch (error) {
    console.error("[contact] email delivery failed", { code: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
    return NextResponse.json({ error: "Não foi possível enviar sua mensagem agora. Tente novamente mais tarde." }, { status: 500 });
  }
}

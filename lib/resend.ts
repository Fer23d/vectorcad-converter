import { createElement, type ReactElement } from "react";
import { Resend } from "resend";
import { DailyLimitReachedEmail } from "@/emails/daily-limit-reached-email";
import { PasswordResetEmail } from "@/emails/password-reset-email";
import { PaymentApprovedEmail } from "@/emails/payment-approved-email";
import { WelcomeEmail } from "@/emails/welcome-email";

function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "") || "";
}

const resendApiKey = cleanEnv(process.env.RESEND_API_KEY);
const fromEmail = cleanEnv(process.env.RESEND_FROM_EMAIL) || "VectorCAD <noreply@vetorcad.com.br>";
const appUrl = cleanEnv(process.env.NEXT_PUBLIC_APP_URL) || "https://vetorcad.com.br";

let resendClient: Resend | null = null;

export function isResendConfigured() {
  return Boolean(resendApiKey);
}

export function getAppUrl(path = "/") {
  const base = appUrl.replace(/\/$/, "");
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${safePath}`;
}

function getResendClient() {
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY nao configurada.");
  }

  resendClient ??= new Resend(resendApiKey);
  return resendClient;
}

async function sendVectorCadEmail({
  to,
  subject,
  react,
  text,
}: {
  to: string;
  subject: string;
  react: ReactElement;
  text: string;
}) {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    react,
    text,
  });

  if (error) {
    throw new Error(error.message || "Nao foi possivel enviar email pelo Resend.");
  }

  return data;
}

export async function sendWelcomeEmail({ to, name }: { to: string; name: string }) {
  return sendVectorCadEmail({
    to,
    subject: "Bem-vindo ao VectorCAD",
    react: createElement(WelcomeEmail, { name: name || "Usuario VectorCAD", dashboardUrl: getAppUrl("/dashboard") }),
    text: `Bem-vindo ao VectorCAD, ${name || "Usuario VectorCAD"}. Sua conta ja esta ativa.`,
  });
}

export async function sendPasswordResetEmail({ to, name, resetUrl }: { to: string; name: string; resetUrl: string }) {
  return sendVectorCadEmail({
    to,
    subject: "Redefina sua senha no VectorCAD",
    react: createElement(PasswordResetEmail, { name, resetUrl }),
    text: `Use este link seguro para redefinir sua senha no VectorCAD: ${resetUrl}`,
  });
}

export async function sendPaymentApprovedEmail({ to, name, plan }: { to: string; name: string; plan: string }) {
  return sendVectorCadEmail({
    to,
    subject: `Pagamento aprovado - Plano ${plan.toUpperCase()} VectorCAD`,
    react: createElement(PaymentApprovedEmail, { name, plan, dashboardUrl: getAppUrl("/dashboard") }),
    text: `Pagamento aprovado. Seu plano ${plan.toUpperCase()} foi ativado no VectorCAD.`,
  });
}

export async function sendDailyLimitReachedEmail({ to, name, used, limit }: { to: string; name: string; used: number; limit: number }) {
  return sendVectorCadEmail({
    to,
    subject: "Limite diario atingido no VectorCAD",
    react: createElement(DailyLimitReachedEmail, { name, used, limit, pricingUrl: getAppUrl("/pricing") }),
    text: `Voce atingiu o limite diario do plano FREE no VectorCAD: ${used}/${limit} usos hoje.`,
  });
}

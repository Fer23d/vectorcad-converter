import { createElement, type ReactElement } from "react";
import { Resend } from "resend";
import { DailyLimitReachedEmail } from "@/emails/daily-limit-reached-email";
import { EmailConfirmationEmail } from "@/emails/email-confirmation-email";
import { PaymentApprovedEmail } from "@/emails/payment-approved-email";
import { WelcomeEmail } from "@/emails/welcome-email";

function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "") || "";
}

const resendApiKey = cleanEnv(process.env.RESEND_API_KEY);
const fromEmail = cleanEnv(process.env.RESEND_FROM_EMAIL) || "vetorcad <contato@vetorcad.com.br>";
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
    throw new Error("RESEND_API_KEY não configurada.");
  }

  resendClient ??= new Resend(resendApiKey);
  return resendClient;
}

async function sendVectorCadEmail({
  to,
  subject,
  react,
  html,
  text,
}: {
  to: string;
  subject: string;
  react?: ReactElement;
  html?: string;
  text: string;
}) {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    ...(html ? { html } : { react }),
    text,
  });

  if (error) {
    throw new Error(error.message || "Não foi possível enviar e-mail pelo Resend.");
  }

  return data;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function passwordResetEmailHtml(resetUrl: string) {
  const safeResetUrl = escapeHtml(resetUrl);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <title>Redefini&ccedil;&atilde;o de senha</title>
  </head>
  <body style="margin:0;padding:0;background:#050807;color:#eef5f1;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#050807;margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:36px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;border-collapse:collapse;">
            <tr>
              <td style="padding:0 0 18px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td align="center" valign="middle" style="width:48px;height:48px;border-radius:16px;background:#b7f34a;color:#09120d;font-size:15px;font-weight:900;line-height:48px;text-align:center;">VC</td>
                    <td style="padding-left:14px;">
                      <div style="font-size:16px;line-height:20px;font-weight:900;letter-spacing:1px;color:#f2f8f4;">vetorcad</div>
                      <div style="font-size:12px;line-height:18px;color:#91a098;">SaaS para engenharia, tecnologia e produtividade CAD</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #26312c;border-radius:28px;background:#101613;padding:34px;box-shadow:0 24px 80px rgba(0,0,0,.38);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:0 0 12px 0;font-size:11px;line-height:16px;font-weight:900;letter-spacing:2.4px;text-transform:uppercase;color:#b7f34a;">Seguran&ccedil;a da conta</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 18px 0;font-size:32px;line-height:36px;font-weight:900;color:#edf5f0;">Redefini&ccedil;&atilde;o de senha</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 16px 0;font-size:15px;line-height:26px;color:#a6b4ad;">Ol&aacute;!</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 16px 0;font-size:15px;line-height:26px;color:#a6b4ad;">Recebemos uma solicita&ccedil;&atilde;o para redefinir a senha da sua conta vetorcad.</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 24px 0;font-size:15px;line-height:26px;color:#a6b4ad;">Clique no bot&atilde;o abaixo para criar uma nova senha com seguran&ccedil;a.</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 26px 0;">
                      <a href="${safeResetUrl}" style="display:inline-block;background:#b7f34a;color:#09120d;border-radius:14px;padding:15px 24px;font-size:14px;line-height:18px;font-weight:900;text-decoration:none;">Redefinir senha</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px;border:1px solid #2d3933;border-radius:18px;background:#0b100e;font-size:13px;line-height:22px;color:#93a29a;">Se voc&ecirc; n&atilde;o solicitou essa altera&ccedil;&atilde;o, ignore este e-mail. Sua conta continuar&aacute; protegida.</td>
                  </tr>
                  <tr>
                    <td style="padding:28px 0 0 0;font-size:15px;line-height:26px;color:#a6b4ad;">Atenciosamente<br><strong style="color:#edf5f0;">Equipe vetorcad</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:26px 0 0 0;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;border-top:1px solid #26312c;">
                        <tr>
                          <td style="padding-top:20px;font-size:12px;line-height:20px;color:#7e8c85;">
                            <strong style="color:#edf5f0;letter-spacing:1.1px;">Grupo ShiftCore</strong><br>
                            Tecnologia, inovação e soluções inteligentes.<br>
                            &copy; 2026 vetorcad. Todos os direitos reservados.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendWelcomeEmail({ to, name }: { to: string; name: string }) {
  const displayName = name || "Usuário vetorcad";

  return sendVectorCadEmail({
    to,
    subject: "Bem-vindo ao vetorcad \u{1F680} Sua \u00e1rea de projetos est\u00e1 pronta",
    react: createElement(WelcomeEmail, { name: displayName, dashboardUrl: getAppUrl("/dashboard") }),
    text: `Olá, ${displayName}!\n\nSeja bem-vindo ao vetorcad.\n\nSua conta foi criada com sucesso e agora você tem acesso a uma plataforma desenvolvida para facilitar análises, organização e gerenciamento de projetos de engenharia.\n\n- Analisar arquivos CAD de forma inteligente\n- Identificar informações técnicas do projeto\n- Gerar relatórios organizados\n- Centralizar seus projetos em um único workspace\n\nSeu próximo passo:\nAcesse sua conta e envie seu primeiro projeto.\n\nEstamos construindo uma nova forma de trabalhar com projetos técnicos, unindo engenharia, automação e inteligência.\n\nAtenciosamente\n\nEquipe vetorcad\n\nGrupo ShiftCore\nTecnologia, inovação e soluções inteligentes.\n\n© 2026 vetorcad. Todos os direitos reservados.`,
  });
}

export async function sendEmailConfirmationEmail({ to, name, confirmUrl }: { to: string; name: string; confirmUrl: string }) {
  const displayName = name || "usuário";

  return sendVectorCadEmail({
    to,
    subject: "Confirme sua conta vetorcad 🚀",
    react: createElement(EmailConfirmationEmail, { name: displayName, confirmUrl }),
    text: `Olá, ${displayName}.\n\nSua conta vetorcad foi criada com sucesso.\n\nPara começar a utilizar a plataforma, confirme seu endereço de e-mail clicando no link abaixo:\n${confirmUrl}\n\nApós a confirmação, você terá acesso ao seu workspace.\n\nAtenciosamente\n\nEquipe vetorcad\n\nGrupo ShiftCore\nTecnologia, inovação e soluções inteligentes.\n\n© 2026 vetorcad. Todos os direitos reservados.`,
  });
}

export async function sendPasswordResetEmail({ to, resetUrl }: { to: string; name: string; resetUrl: string }) {
  return sendVectorCadEmail({
    to,
    subject: "Redefini\u00e7\u00e3o de senha da sua conta vetorcad",
    html: passwordResetEmailHtml(resetUrl),
    text: `Olá!\n\nRecebemos uma solicitação para redefinir a senha da sua conta vetorcad.\n\nClique no link abaixo para criar uma nova senha com segurança:\n${resetUrl}\n\nSe você não solicitou essa alteração, ignore este e-mail. Sua conta continuará protegida.\n\nAtenciosamente\n\nEquipe vetorcad\n\nGrupo ShiftCore\nTecnologia, inovação e soluções inteligentes.\n\n© 2026 vetorcad. Todos os direitos reservados.`,
  });
}

export async function sendPaymentApprovedEmail({ to, name, plan }: { to: string; name: string; plan: string }) {
  return sendVectorCadEmail({
    to,
    subject: `Pagamento aprovado - Plano ${plan.toUpperCase()} vetorcad`,
    react: createElement(PaymentApprovedEmail, { name, plan, dashboardUrl: getAppUrl("/dashboard") }),
    text: `Pagamento aprovado. Seu plano ${plan.toUpperCase()} foi ativado no vetorcad.`,
  });
}

export async function sendDailyLimitReachedEmail({ to, name, used, limit }: { to: string; name: string; used: number; limit: number }) {
  return sendVectorCadEmail({
    to,
    subject: "Limite diário atingido no vetorcad",
    react: createElement(DailyLimitReachedEmail, { name, used, limit, pricingUrl: getAppUrl("/pricing") }),
    text: `Você atingiu o limite diário do plano FREE no vetorcad: ${used}/${limit} usos hoje.`,
  });
}

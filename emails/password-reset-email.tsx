import { EmailParagraph, EmailShell } from "@/emails/email-shell";

export function PasswordResetEmail({ resetUrl }: { name: string; resetUrl: string }) {
  return (
    <EmailShell
      preview="Crie uma nova senha de forma segura para acessar sua conta."
      eyebrow="Segurança da conta"
      title="Redefinição de senha"
      ctaHref={resetUrl}
      ctaLabel="Redefinir minha senha"
    >
      <EmailParagraph>Olá, tudo bem?</EmailParagraph>
      <EmailParagraph>
        Recebemos uma solicitação para redefinir a senha da sua conta vetorcad.
      </EmailParagraph>
      <EmailParagraph>
        Para criar uma nova senha com segurança, clique no botão abaixo:
      </EmailParagraph>
      <EmailParagraph>
        Este link é válido por tempo limitado e foi criado para proteger o acesso à sua conta.
      </EmailParagraph>
      <EmailParagraph>
        Caso você não tenha solicitado essa alteração, ignore este e-mail. Sua conta continuará segura e nenhuma alteração será realizada.
      </EmailParagraph>
      <EmailParagraph>
        Se precisar de ajuda, nossa equipe está à disposição.
      </EmailParagraph>
    </EmailShell>
  );
}

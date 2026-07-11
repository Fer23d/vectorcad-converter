import { EmailParagraph, EmailShell } from "@/emails/email-shell";

export function PasswordResetEmail({ name, resetUrl }: { name: string; resetUrl: string }) {
  return (
    <EmailShell
      preview="Use este link seguro para redefinir sua senha no VectorCAD."
      eyebrow="Seguranca"
      title={`Redefinicao de senha${name ? ` para ${name}` : ""}`}
      ctaHref={resetUrl}
      ctaLabel="Redefinir senha"
    >
      <EmailParagraph>
        Recebemos uma solicitacao para redefinir a senha da sua conta VectorCAD. Clique no botao abaixo para abrir o link seguro de recuperacao.
      </EmailParagraph>
      <EmailParagraph>
        Se voce nao solicitou essa alteracao, ignore este e-mail. O acesso a sua conta continua protegido.
      </EmailParagraph>
    </EmailShell>
  );
}

import { EmailParagraph, EmailShell } from "@/emails/email-shell";

export function EmailConfirmationEmail({ name, confirmUrl }: { name: string; confirmUrl: string }) {
  return (
    <EmailShell
      preview="Confirme sua conta VectorCAD para acessar seu workspace."
      title="Confirme sua conta"
      eyebrow="Ativação de conta"
      ctaHref={confirmUrl}
      ctaLabel="Confirmar minha conta"
    >
      <EmailParagraph>Olá, {name}.</EmailParagraph>
      <EmailParagraph>Sua conta VectorCAD foi criada com sucesso.</EmailParagraph>
      <EmailParagraph>
        Para começar a utilizar a plataforma, confirme seu endereço de e-mail clicando no botão abaixo.
      </EmailParagraph>
      <EmailParagraph>Após a confirmação, você terá acesso ao seu workspace.</EmailParagraph>
    </EmailShell>
  );
}

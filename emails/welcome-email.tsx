import { EmailParagraph, EmailShell } from "@/emails/email-shell";

export function WelcomeEmail({ name, dashboardUrl }: { name: string; dashboardUrl: string }) {
  return (
    <EmailShell
      preview="Sua conta VectorCAD foi criada com sucesso."
      eyebrow="Conta criada"
      title={`Bem-vindo ao VectorCAD, ${name}.`}
      ctaHref={dashboardUrl}
      ctaLabel="Abrir dashboard"
    >
      <EmailParagraph>
        Sua conta ja esta ativa. Voce pode criar projetos, converter imagens em SVG/DXF e preparar arquivos editaveis para CAD, CNC e corte laser.
      </EmailParagraph>
      <EmailParagraph>
        Para melhores resultados, use imagens com bom contraste, fundo simples e bordas bem definidas.
      </EmailParagraph>
    </EmailShell>
  );
}

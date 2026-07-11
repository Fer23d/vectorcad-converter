import { EmailParagraph, EmailShell } from "@/emails/email-shell";

export function PaymentApprovedEmail({ name, plan, dashboardUrl }: { name: string; plan: string; dashboardUrl: string }) {
  return (
    <EmailShell
      preview={`Pagamento aprovado. Plano ${plan.toUpperCase()} liberado no VectorCAD.`}
      eyebrow="Pagamento aprovado"
      title={`Plano ${plan.toUpperCase()} ativado`}
      ctaHref={dashboardUrl}
      ctaLabel="Usar recursos liberados"
    >
      <EmailParagraph>
        {name ? `${name}, seu pagamento foi aprovado.` : "Seu pagamento foi aprovado."} O plano {plan.toUpperCase()} ja foi sincronizado com sua conta VectorCAD.
      </EmailParagraph>
      <EmailParagraph>
        Agora voce pode continuar usando os recursos do seu plano, com limites e exportacoes liberados conforme a assinatura contratada.
      </EmailParagraph>
    </EmailShell>
  );
}

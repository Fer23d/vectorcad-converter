import { EmailParagraph, EmailShell } from "@/emails/email-shell";

export function DailyLimitReachedEmail({ name, used, limit, pricingUrl }: { name: string; used: number; limit: number; pricingUrl: string }) {
  return (
    <EmailShell
      preview={`Você usou ${used}/${limit} conversões gratuitas hoje no VectorCAD.`}
      eyebrow="Limite diário"
      title="Limite gratuito atingido"
      ctaHref={pricingUrl}
      ctaLabel="Ver planos"
    >
      <EmailParagraph>
        {name ? `${name}, você atingiu` : "Você atingiu"} o limite diário do plano FREE: {used}/{limit} usos hoje.
      </EmailParagraph>
      <EmailParagraph>
        O contador reinicia automaticamente no próximo dia. Para continuar agora, faça upgrade para PLUS ou PRO.
      </EmailParagraph>
    </EmailShell>
  );
}

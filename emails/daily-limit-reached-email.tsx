import { EmailParagraph, EmailShell } from "@/emails/email-shell";

export function DailyLimitReachedEmail({ name, used, limit, pricingUrl }: { name: string; used: number; limit: number; pricingUrl: string }) {
  return (
    <EmailShell
      preview={`Voce usou ${used}/${limit} conversoes gratuitas hoje no VectorCAD.`}
      eyebrow="Limite diario"
      title="Limite gratuito atingido"
      ctaHref={pricingUrl}
      ctaLabel="Ver planos"
    >
      <EmailParagraph>
        {name ? `${name}, voce atingiu` : "Voce atingiu"} o limite diario do plano FREE: {used}/{limit} usos hoje.
      </EmailParagraph>
      <EmailParagraph>
        O contador reinicia automaticamente no proximo dia. Para continuar agora, faca upgrade para PLUS ou PRO.
      </EmailParagraph>
    </EmailShell>
  );
}

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

const colors = {
  background: "#070b09",
  card: "#101613",
  border: "#26312c",
  text: "#edf5f0",
  muted: "#9aa9a1",
  neon: "#b7f34a",
  dark: "#09120d",
};

export function EmailShell({
  preview,
  title,
  eyebrow,
  children,
  ctaHref,
  ctaLabel,
}: {
  preview: string;
  title: string;
  eyebrow: string;
  children: ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <Html lang="pt-br">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brandRow}>
            <Text style={logo}>VC</Text>
            <Section style={{ display: "inline-block", verticalAlign: "middle" }}>
              <Text style={brand}>vetorcad</Text>
              <Text style={brandSub}>Plataforma SaaS para conversão CAD</Text>
            </Section>
          </Section>
          <Section style={card}>
            <Text style={eyebrowStyle}>{eyebrow}</Text>
            <Heading style={heading}>{title}</Heading>
            <Section style={content}>{children}</Section>
            {ctaHref && ctaLabel ? (
              <Button href={ctaHref} style={button}>
                {ctaLabel}
              </Button>
            ) : null}
            <Hr style={hr} />
            <Text style={signatureText}>Atenciosamente</Text>
            <Text style={signatureTeam}>Equipe vetorcad</Text>
            <Text style={footerBrand}>Grupo ShiftCore</Text>
            <Text style={footerText}>Tecnologia, inovação e soluções inteligentes.</Text>
            <Text style={footerNotice}>© 2026 vetorcad. Todos os direitos reservados.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailParagraph({ children }: { children: ReactNode }) {
  return <Text style={paragraph}>{children}</Text>;
}

const body: CSSProperties = {
  margin: 0,
  backgroundColor: colors.background,
  color: colors.text,
  fontFamily: "Arial, Helvetica, sans-serif",
};

const container: CSSProperties = {
  width: "100%",
  maxWidth: "620px",
  margin: "0 auto",
  padding: "42px 18px",
};

const brandRow: CSSProperties = {
  marginBottom: "20px",
};

const logo: CSSProperties = {
  display: "inline-block",
  width: "46px",
  height: "46px",
  margin: "0 14px 0 0",
  borderRadius: "16px",
  backgroundColor: colors.neon,
  color: colors.dark,
  fontSize: "15px",
  fontWeight: 900,
  lineHeight: "46px",
  textAlign: "center",
  verticalAlign: "middle",
};

const brand: CSSProperties = {
  margin: 0,
  color: colors.text,
  fontSize: "15px",
  fontWeight: 900,
  letterSpacing: "3px",
};

const brandSub: CSSProperties = {
  margin: "3px 0 0",
  color: colors.muted,
  fontSize: "11px",
};

const card: CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderRadius: "28px",
  backgroundColor: colors.card,
  padding: "34px",
  boxShadow: "0 24px 80px rgba(0,0,0,.38)",
};

const eyebrowStyle: CSSProperties = {
  margin: "0 0 12px",
  color: colors.neon,
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "2.4px",
  textTransform: "uppercase",
};

const heading: CSSProperties = {
  margin: "0 0 18px",
  color: colors.text,
  fontSize: "32px",
  lineHeight: "1.12",
  fontWeight: 900,
};

const content: CSSProperties = {
  marginTop: "8px",
};

const paragraph: CSSProperties = {
  margin: "0 0 16px",
  color: colors.muted,
  fontSize: "15px",
  lineHeight: "1.7",
};

const button: CSSProperties = {
  display: "inline-block",
  marginTop: "14px",
  borderRadius: "14px",
  backgroundColor: colors.neon,
  color: colors.dark,
  fontSize: "14px",
  fontWeight: 900,
  textDecoration: "none",
  padding: "15px 22px",
};

const hr: CSSProperties = {
  borderColor: colors.border,
  margin: "32px 0 20px",
};

const signatureText: CSSProperties = {
  margin: 0,
  color: colors.muted,
  fontSize: "13px",
  lineHeight: "1.6",
};

const signatureTeam: CSSProperties = {
  margin: "4px 0 18px",
  color: colors.text,
  fontSize: "14px",
  lineHeight: "1.6",
  fontWeight: 800,
};

const footerBrand: CSSProperties = {
  margin: 0,
  color: colors.text,
  fontSize: "13px",
  lineHeight: "1.5",
  fontWeight: 900,
  letterSpacing: "1.6px",
};

const footerText: CSSProperties = {
  margin: "8px 0 0",
  color: "#8d9a93",
  fontSize: "12px",
  lineHeight: "1.7",
};

const footerNotice: CSSProperties = {
  margin: "16px 0 0",
  color: "#6f7d75",
  fontSize: "11px",
  lineHeight: "1.6",
};

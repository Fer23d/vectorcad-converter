import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://vetorcad.com.br"),
  title: "VectorCAD",
  description: "Conversão inteligente de desenhos técnicos para CAD usando Inteligência Artificial.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "VectorCAD",
    description: "Conversão inteligente de desenhos técnicos para CAD usando Inteligência Artificial.",
    url: "https://vetorcad.com.br",
    siteName: "VectorCAD",
    images: [{ url: "/icon.png", width: 512, height: 512, alt: "Logo VectorCAD" }],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "VectorCAD",
    description: "Conversão inteligente de desenhos técnicos para CAD usando Inteligência Artificial.",
    images: ["/icon.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-br">
  <head />
  <body>
    {children}
    <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" />
  </body></html>;
}

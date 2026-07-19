import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://vetorcad.com.br"),
  title: "vetorcad",
  description: "vetorcad Converter: conversão de desenhos técnicos para CAD com pré-processamento de imagem e vetorização por contorno.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "vetorcad",
    description: "vetorcad Converter: conversão de desenhos técnicos para CAD com pré-processamento de imagem e vetorização por contorno.",
    url: "https://vetorcad.com.br",
    siteName: "vetorcad",
    images: [{ url: "/icon.png", width: 512, height: 512, alt: "Logo vetorcad" }],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "vetorcad",
    description: "vetorcad Converter: conversão de desenhos técnicos para CAD com pré-processamento de imagem e vetorização por contorno.",
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

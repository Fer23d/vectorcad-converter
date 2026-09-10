import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://vetorcad.com.br"),
  applicationName: "VetorCAD",
  title: "VetorCAD",
  description: "VetorCAD Converter: conversão de desenhos técnicos para CAD com pré-processamento de imagem e vetorização por contorno.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "VetorCAD",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "VetorCAD",
    description: "VetorCAD Converter: conversão de desenhos técnicos para CAD com pré-processamento de imagem e vetorização por contorno.",
    url: "https://vetorcad.com.br",
    siteName: "VetorCAD",
    images: [{ url: "/icon-512x512.png", width: 512, height: 512, alt: "Ícone oficial do VetorCAD" }],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "VetorCAD",
    description: "VetorCAD Converter: conversão de desenhos técnicos para CAD com pré-processamento de imagem e vetorização por contorno.",
    images: ["/icon-512x512.png"],
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

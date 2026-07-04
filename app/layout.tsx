import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "VectorCAD Converter",
  description: "Converta imagens raster em SVG e DXF editáveis para CAD.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>
    {children}
    <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" />
    <Script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5004421599745939"
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  </body></html>;
}

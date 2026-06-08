import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VectorCAD Converter",
  description: "Converta imagens raster em SVG e DXF editáveis para CAD.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}

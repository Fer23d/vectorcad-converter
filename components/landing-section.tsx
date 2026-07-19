"use client";

import { CTAButton } from "@/components/cta-button";
import { FeatureCard } from "@/components/feature-card";
import { ParallaxBackground } from "@/components/parallax-background";
import { ScrollProgressIndicator } from "@/components/scroll-progress-indicator";
import { SVGPreview } from "@/components/svg-preview";
import { useEffect, useState } from "react";

const features = [
  {
    title: "Contornos editáveis",
    description: "Transforme bordas e formas da imagem em paths organizados para seus fluxos de CAD e CAM.",
    icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h10M4 17h16" /><circle cx="18" cy="12" r="2" /></svg>,
  },
  {
    title: "Camadas e escala",
    description: "Visualize o desenho com mais clareza, organize o resultado e trabalhe em mm, cm ou px.",
    icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m4 7 8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4" /></svg>,
  },
  {
    title: "Pré-processamento técnico",
    description: "Ajuste contraste, ruído e nitidez antes da conversão para obter linhas mais consistentes.",
    icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5h14v14H5zM8 15l2.5-3 2 2 2.5-4 2 3" /><circle cx="9" cy="9" r="1" /></svg>,
  },
  {
    title: "SVG e DXF prontos",
    description: "Exporte arquivos editáveis para AutoCAD, CNC, corte laser, Illustrator e outros fluxos técnicos.",
    icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h8l4 4v14H6zM14 3v5h5M9 14h6M9 18h6" /></svg>,
  },
];

export function LandingSection() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        frame = 0;
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const pageHeight = typeof document === "undefined" ? 1 : Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const scrollProgress = Math.min(1, scrollY / pageHeight);
  const stickyCtaActive = scrollY > 220;

  return (
    <section id="inicio" className="relative isolate overflow-hidden border-b border-[#1c2822] bg-[#070b09]">
      <ScrollProgressIndicator />
      <ParallaxBackground />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-16 sm:pt-20 lg:px-8 lg:pb-16 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[.92fr_1.08fr] lg:gap-16">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#b7f34a]/35 bg-[#b7f34a]/10 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b7f34a] shadow-[0_0_10px_#b7f34a]" /> VectorCAD Converter
            </div>
            <h1 className="max-w-xl text-4xl font-black leading-[1.05] tracking-[-.055em] text-[#f2f8f4] sm:text-5xl lg:text-6xl">Transforme imagens em vetores para CAD, CNC e corte laser</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#b8c8c0] sm:text-lg">Converta PNG, JPG, WEBP, TIF e TIFF em SVG e DXF editáveis com pré-processamento de imagem e vetorização por contorno.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <CTAButton>Comece a vetorização</CTAButton>
              <span className="text-sm text-[#8ea098]">Do desenho ao arquivo CAD editável.</span>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold uppercase tracking-[.12em] text-[#81958a]">
              <span>PNG / JPG / TIFF</span><span>SVG + DXF</span><span>Escala técnica</span>
            </div>
          </div>
          <div className="lg:pt-4"><SVGPreview scrollProgress={scrollProgress} /></div>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {features.map((feature, index) => <FeatureCard key={feature.title} {...feature} index={index} scrollY={scrollY} />)}
        </div>

        <div className={`sticky bottom-4 z-10 mt-10 flex items-center justify-between gap-4 rounded-2xl border bg-[#0a120e]/90 px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur transition-all duration-500 sm:px-5 ${stickyCtaActive ? "border-[#b7f34a]/60 shadow-[0_0_28px_rgba(183,243,74,.12)]" : "border-[#b7f34a]/25"}`}>
          <p className="hidden text-sm text-[#b8c8c0] sm:block"><span className="font-black text-[#edf5f0]">Pronto para começar?</span> Converta seu primeiro desenho técnico.</p>
          <CTAButton className={`w-full sm:w-auto ${stickyCtaActive ? "animate-[pulse_3s_ease-in-out_infinite]" : ""}`}>Comece a vetorização</CTAButton>
        </div>
      </div>
    </section>
  );
}

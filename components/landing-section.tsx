"use client";

import { CTAButton } from "@/components/cta-button";
import { FeatureCard } from "@/components/feature-card";
import { ParallaxBackground } from "@/components/parallax-background";
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

const contactEmail = "contato@vetorcad.com.br";
const adMailto = `mailto:${contactEmail}?subject=${encodeURIComponent("Quero anunciar no VetorCAD")}&body=${encodeURIComponent("Olá, gostaria de receber informações sobre anúncios no VetorCAD.")}`;
const adItems = Array.from({ length: 8 }, (_, index) => index);

function AdSideBox({ direction }: { direction: "up" | "down" }) {
  return (
    <aside className="ad-side-box group hidden h-[430px] overflow-hidden rounded-[1.75rem] border border-[#26382e] bg-[#0a100d]/85 p-3 shadow-2xl shadow-black/25 transition duration-300 hover:border-[#b7f34a]/45 hover:shadow-[0_0_26px_rgba(183,243,74,.08)] xl:block" aria-label="Espaço publicitário">
      <div className="relative h-full overflow-hidden rounded-[1.35rem] border border-[#1d2d24] bg-[linear-gradient(180deg,rgba(183,243,74,.07),transparent_26%,rgba(183,243,74,.04))]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-[#0a100d] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-[#0a100d] to-transparent" />
        <div className={`ad-side-box-track flex flex-col items-center gap-5 py-5 ${direction === "up" ? "ad-side-box-track-up" : "ad-side-box-track-down"}`}>
          {[0, 1].map((group) => (
            <div key={group} className="flex flex-col items-center gap-5" aria-hidden={group === 1}>
              {adItems.map((item) => (
                <a key={`${group}-${item}`} href={adMailto} className="writing-vertical text-center text-[10px] font-black uppercase tracking-[.28em] text-[#b7f34a]/80 transition duration-300 hover:text-[#eaffbf] focus:outline-none focus:ring-2 focus:ring-[#b7f34a]/40">
                  ANUNCIE AQUI <span className="text-[#b7f34a]/35">•</span>
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

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
      <ParallaxBackground />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-16 sm:pt-20 lg:px-8 lg:pb-16 lg:pt-24">
        <div className="grid items-center gap-5 xl:grid-cols-[92px_minmax(0,1fr)_92px] 2xl:grid-cols-[112px_minmax(0,1fr)_112px]">
          <AdSideBox direction="up" />
          <div className="grid min-w-0 items-center gap-12 lg:grid-cols-[.92fr_1.08fr] lg:gap-16">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#b7f34a]/35 bg-[#b7f34a]/10 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#b7f34a] shadow-[0_0_10px_#b7f34a]" /> vetorcad Converter
              </div>
              <h1 className="max-w-xl text-4xl font-black leading-[1.05] tracking-[-.055em] text-[#f2f8f4] sm:text-5xl lg:text-6xl">Transforme imagens e PDFs em vetores para CAD, CNC e corte laser</h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#b8c8c0] sm:text-lg">Converta PNG, JPG, WEBP, TIF, TIFF e PDFs técnicos em SVG e DXF editáveis com pré-processamento de imagem e vetorização por contorno.</p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <CTAButton>Comece a vetorização</CTAButton>
                <span className="text-sm text-[#8ea098]">Do desenho ao arquivo CAD editável.</span>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold uppercase tracking-[.12em] text-[#81958a]">
                <span>PNG / JPG / WEBP / TIFF / PDF</span><span>SVG + DXF</span><span>PDF técnico suportado</span>
              </div>
            </div>
            <div className="min-w-0 lg:pt-4">
              <SVGPreview scrollProgress={scrollProgress} />
            </div>
          </div>
          <AdSideBox direction="down" />
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {features.map((feature, index) => <FeatureCard key={feature.title} {...feature} index={index} scrollY={scrollY} />)}
        </div>

        <div className={`sticky bottom-4 z-10 mt-10 flex items-center justify-between gap-4 rounded-2xl border bg-[#0a120e]/90 px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur transition-all duration-500 sm:px-5 ${stickyCtaActive ? "border-[#b7f34a]/60 shadow-[0_0_28px_rgba(183,243,74,.12)]" : "border-[#b7f34a]/25"}`}>
          <p className="hidden text-sm text-[#b8c8c0] sm:block"><span className="font-black text-[#edf5f0]">Pronto para começar?</span> Converta seu primeiro desenho técnico.</p>
          <CTAButton className={`w-full sm:w-auto ${stickyCtaActive ? "animate-[pulse_3s_ease-in-out_infinite]" : ""}`}>Comece a vetorização</CTAButton>
        </div>
      </div>
      <style>{`
        .writing-vertical {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }

        .ad-side-box-track {
          min-height: 200%;
          will-change: transform;
        }

        .ad-side-box-track-up {
          animation: vetorcad-ad-scroll-up 18s linear infinite;
        }

        .ad-side-box-track-down {
          animation: vetorcad-ad-scroll-down 18s linear infinite;
        }

        .ad-side-box:hover .ad-side-box-track {
          animation-play-state: paused;
        }

        @keyframes vetorcad-ad-scroll-up {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }

        @keyframes vetorcad-ad-scroll-down {
          from { transform: translateY(-50%); }
          to { transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .ad-side-box-track-up,
          .ad-side-box-track-down {
            animation: none;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}

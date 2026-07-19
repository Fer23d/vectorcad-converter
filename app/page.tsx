import type { Metadata } from "next";
import Link from "next/link";
import { PublicSiteShell } from "@/components/public-site-shell";
import { FAQSection } from "@/components/faq-section";
import { LandingSection } from "@/components/landing-section";
import { blogArticles } from "@/lib/public-content";

export const metadata: Metadata = {
  title: "VectorCAD Converter | Conversão de desenhos técnicos para CAD",
  description: "Transforme imagens e desenhos técnicos em arquivos CAD editáveis com reconhecimento inteligente de textos, anotações e elementos do projeto.",
  alternates: { canonical: "https://vetorcad.com.br/" },
};

const benefits = [
  "DXF com linhas e contornos editáveis para CAD/CAM",
  "SVG limpo para CorelDRAW, Illustrator e fluxos web",
  "Ajustes de threshold, contraste, ruído e escala real em mm",
  "Base para extrusão 3D e exportação STL/GLB",
];

const steps = [
  { title: "1. Envie a imagem", text: "Use PNG, JPG, JPEG, WEBP, TIF ou TIFF com boa resolução e contraste." },
  { title: "2. Limpe o desenho", text: "Ajuste brilho, contraste, limiar, ruído e bordas antes da vetorização." },
  { title: "3. Gere o vetor", text: "Transforme áreas da imagem em paths, contornos e polilinhas editáveis." },
  { title: "4. Exporte para CAD", text: "Baixe SVG ou DXF com escala correta para abrir em softwares técnicos." },
];

export default function Home() {
  return (
    <PublicSiteShell>
      <LandingSection />

      <section className="relative overflow-hidden border-b border-[#1c2822] bg-[#0a0f0d]">
        <div className="absolute -right-24 top-10 h-64 w-64 rounded-full bg-[#b7f34a]/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-[#b7f34a]/40 bg-[#b7f34a]/10 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">VectorCAD Converter</span>
            <h2 className="mt-6 text-3xl font-black leading-tight tracking-[-.04em] md:text-5xl">VectorCAD Converter: conversão CAD profissional</h2>
            <p className="mt-5 text-lg leading-8 text-[#b8c8c0]">Transforme imagens e desenhos técnicos em arquivos CAD editáveis com reconhecimento inteligente de textos, anotações e elementos do projeto.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-3xl border border-[#304238] bg-[#070b09] p-5">
              <h3 className="font-black text-[#b7f34a]">Processamento inteligente para desenhos técnicos</h3>
              <p className="mt-3 text-sm leading-6 text-[#aebeb6]">O VectorCAD prepara seu desenho para identificar informações técnicas e auxiliar na conversão para CAD.</p>
            </article>
            <article className="rounded-3xl border border-[#304238] bg-[#070b09] p-5">
              <h3 className="font-black text-[#b7f34a]">Textos inteligentes</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#c3d0ca]"><li>✓ Títulos</li><li>✓ Legendas</li><li>✓ Anotações</li><li>✓ Identificações técnicas</li></ul>
            </article>
            <article className="rounded-3xl border border-[#304238] bg-[#070b09] p-5">
              <h3 className="font-black text-[#b7f34a]">Projetado para engenharia</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#c3d0ca]"><li>✓ Plantas industriais</li><li>✓ Diagramas</li><li>✓ Instrumentação</li><li>✓ Arquitetura</li><li>✓ Projetos técnicos</li></ul>
            </article>
            <article className="rounded-3xl border border-[#304238] bg-[#070b09] p-5">
              <h3 className="font-black text-[#b7f34a]">Exportação profissional</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#c3d0ca]"><li>✓ DXF editável</li><li>✓ SVG vetorial</li><li>✓ Camadas organizadas</li></ul>
            </article>
          </div>
          <div className="mt-10 rounded-3xl border border-[#304238] bg-[#070b09] p-6">
            <h3 className="text-xl font-black">Como funciona</h3>
            <div className="mt-6 grid gap-3 text-center text-sm font-bold text-[#c3d0ca] md:grid-cols-5">
              {["Imagem do projeto", "Processamento inteligente", "Reconhecimento de textos", "Análise dos elementos", "Arquivo CAD editável"].map((step, index) => <div key={step} className="flex items-center justify-center gap-3"><span className="flex-1 rounded-2xl border border-[#304238] bg-[#111915] px-4 py-4">{step}</span>{index < 4 && <span className="hidden text-xl text-[#b7f34a] md:inline">→</span>}</div>)}
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/signup" className="rounded-2xl bg-[#b7f34a] px-6 py-4 text-sm font-black text-[#07100a] transition hover:brightness-105">Teste o VectorCAD</Link>
            <span className="text-sm text-[#aebeb6]">Converta seu primeiro desenho técnico.</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <div className="grid gap-4 md:grid-cols-4">
          {benefits.map((benefit) => (
            <div key={benefit} className="rounded-3xl border border-[#223028] bg-[#0d1411] p-5 text-sm leading-6 text-[#c3d0ca]">
              <div className="mb-3 h-2 w-12 rounded-full bg-[#b7f34a]" />
              {benefit}
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#1c2822] bg-[#0a0f0d]">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-black tracking-[-.03em] md:text-4xl">Como funciona a conversão CAD</h2>
            <p className="mt-4 leading-7 text-[#aebeb6]">A ferramenta analisa a imagem, separa áreas claras e escuras, remove pequenos ruídos e transforma bordas em caminhos vetoriais. O resultado pode ser exportado em SVG para design ou DXF para CAD/CAM.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {steps.map((step) => (
              <article key={step.title} className="rounded-3xl border border-[#223028] bg-[#070b09] p-6">
                <h3 className="font-black text-[#b7f34a]">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#aebeb6]">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FAQSection />

      <section className="border-t border-[#1c2822] bg-[#0a0f0d]">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black tracking-[-.03em]">Guias recentes</h2>
              <p className="mt-3 text-[#aebeb6]">Conteúdo editorial para preparar imagens, vetores e arquivos CAD com menos retrabalho.</p>
            </div>
            <Link href="/blog" className="hidden rounded-xl border border-[#304238] px-4 py-3 text-xs font-black text-[#b7f34a] md:inline-flex">Ver blog</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {blogArticles.map((article) => (
              <Link key={article.slug} href={`/blog/${article.slug}`} className="rounded-3xl border border-[#223028] bg-[#070b09] p-6 transition hover:-translate-y-1 hover:border-[#b7f34a]/60 hover:bg-[#101713]">
                <div className="text-[10px] font-black uppercase tracking-[.16em] text-[#b7f34a]">{article.category} · {article.readTime}</div>
                <h3 className="mt-4 text-xl font-black leading-tight">{article.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#aebeb6]">{article.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Download, ScanLine, Upload, WandSparkles } from "lucide-react";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "Demonstração | VetorCAD",
  description: "Veja como o VetorCAD transforma imagens e PDFs técnicos em vetores e arquivos CAD editáveis.",
  alternates: { canonical: "https://vetorcad.com.br/demonstracao" },
};

const processSteps = [
  { number: "01", title: "Arquivo enviado", text: "Imagem técnica, PDF ou planta digitalizada.", icon: Upload },
  { number: "02", title: "Análise inteligente", text: "Linhas, formas e contornos são preparados.", icon: ScanLine },
  { number: "03", title: "Vetorização", text: "O desenho ganha uma base vetorial editável.", icon: WandSparkles },
  { number: "04", title: "Exportação", text: "Baixe SVG ou DXF para o próximo fluxo.", icon: Download },
];

const benefits = [
  "Redução de retrabalho manual",
  "Mais velocidade na preparação de arquivos",
  "Aproveitamento de projetos existentes",
];

function TechnicalDrawing({ result = false }: { result?: boolean }) {
  return (
    <svg viewBox="0 0 480 300" className="w-full" role="img" aria-label={result ? "Vetor CAD editável" : "Desenho técnico original"}>
      <g fill="none" stroke={result ? "#b7f34a" : "#75847b"} strokeLinecap="round" strokeLinejoin="round" strokeWidth={result ? 2 : 3}>
        <path d="M54 58h135v52h66V58h171v190H255v-48h-66v48H54z" />
        <path d="M189 58v52m66-52v52m0 48v90m66-190v190M54 152h135m66 0h171" />
        <circle cx="123" cy="145" r="31" />
        <path d="M92 145h62M123 114v62M326 126h34v38h-34zM343 126v-25m0 63v25M326 145h-26m60 0h26" />
      </g>
      <g fill={result ? "#edf5f0" : "#65746b"} fontFamily="monospace" fontSize="12">
        <text x="76" y="88">PLANTA</text><text x="284" y="225">3500</text><text x="72" y="215">A-01</text>
      </g>
      {result && <g fill="#b7f34a"><circle cx="54" cy="58" r="5" /><circle cx="255" cy="110" r="5" /><circle cx="426" cy="248" r="5" /></g>}
    </svg>
  );
}

export default function DemonstracaoPage() {
  return (
    <PublicSiteShell>
      <main className="overflow-hidden">
        <section className="relative border-b border-[#1c2822] bg-[#070b09]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(183,243,74,.14),transparent_30%),linear-gradient(135deg,#070b09,#0b1510_55%,#070b09)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-32">
            <div className="max-w-4xl"><span className="inline-flex rounded-full border border-[#b7f34a]/35 bg-[#b7f34a]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[.18em] text-[#b7f34a]">Demonstração VetorCAD</span><h1 className="mt-7 text-5xl font-black leading-[1.02] tracking-[-.06em] md:text-7xl">Veja o VetorCAD transformando desenhos técnicos em CAD editável</h1><p className="mt-7 max-w-3xl text-lg leading-8 text-[#b8c8c0]">Envie imagens e PDFs técnicos, prepare a geometria e exporte uma base vetorial para CAD, CNC e corte laser.</p><Link href="/signup" className="mt-9 inline-flex items-center gap-3 rounded-2xl bg-[#b7f34a] px-6 py-4 text-sm font-black text-[#07100a] transition hover:-translate-y-0.5 hover:brightness-105">Testar VetorCAD <ArrowRight size={17} /></Link></div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
          <div className="max-w-2xl"><span className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Antes e depois</span><h2 className="mt-4 text-4xl font-black tracking-[-.05em] md:text-5xl">Da referência técnica ao arquivo editável.</h2><p className="mt-5 text-lg leading-8 text-[#aebeb6]">Compare a entrada original com a geometria organizada para revisão e exportação.</p></div>
          <div className="mt-12 grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center"><article className="rounded-[2rem] border border-[#26382e] bg-[#111915] p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[.16em] text-[#8ea098]">Entrada</span><span className="rounded-full border border-[#304238] px-3 py-1 text-[10px] font-bold text-[#9eafa5]">Imagem / PDF / Planta</span></div><div className="grid min-h-72 place-items-center rounded-2xl border border-[#304238] bg-white p-4"><TechnicalDrawing /></div></article><div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[#b7f34a]/40 bg-[#b7f34a]/10 text-[#b7f34a] lg:h-14 lg:w-14"><ArrowRight size={22} /></div><article className="rounded-[2rem] border border-[#b7f34a]/45 bg-[#101a14] p-5 shadow-[0_0_38px_rgba(183,243,74,.08)] sm:p-7"><div className="mb-5 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">Saída</span><span className="rounded-full border border-[#b7f34a]/35 px-3 py-1 text-[10px] font-bold text-[#b7f34a]">Vetor / CAD editável</span></div><div className="grid min-h-72 place-items-center rounded-2xl border border-[#304238] bg-[#070b09] p-4"><TechnicalDrawing result /></div></article></div>
        </section>

        <section className="border-y border-[#1c2822] bg-[#0a0f0d]"><div className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28"><div className="max-w-2xl"><span className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">O processo</span><h2 className="mt-4 text-4xl font-black tracking-[-.05em] md:text-5xl">Um caminho claro até o CAD.</h2></div><div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{processSteps.map(({ number, title, text, icon: Icon }) => <article key={number} className="rounded-3xl border border-[#26382e] bg-[#0d1411] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#b7f34a]/60"><div className="flex items-start justify-between"><span className="text-3xl font-black text-[#b7f34a]/45">{number}</span><Icon size={21} className="text-[#b7f34a]" /></div><h3 className="mt-8 text-lg font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-[#9eafa5]">{text}</p></article>)}</div></div></section>

        <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28"><div className="max-w-2xl"><span className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Valor prático</span><h2 className="mt-4 text-4xl font-black tracking-[-.05em] md:text-5xl">Mais tempo para revisar o projeto, menos para redesenhar.</h2></div><div className="mt-10 grid gap-4 md:grid-cols-3">{benefits.map((benefit) => <article key={benefit} className="rounded-3xl border border-[#26382e] bg-[#0d1411] p-6"><Check size={21} className="text-[#b7f34a]" /><h3 className="mt-6 text-lg font-black">{benefit}</h3><p className="mt-3 text-sm leading-6 text-[#9eafa5]">Aproveite melhor os arquivos que sua equipe já possui e avance com uma base técnica mais organizada.</p></article>)}</div></section>

        <section className="border-t border-[#1c2822] bg-[#0a0f0d]"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-16 sm:flex-row sm:items-center lg:px-8"><div><h2 className="text-3xl font-black tracking-[-.04em]">Veja seu próximo desenho de outro jeito.</h2><p className="mt-3 text-[#aebeb6]">Teste o VetorCAD com uma imagem ou PDF técnico.</p></div><Link href="/signup" className="inline-flex items-center gap-3 rounded-2xl bg-[#b7f34a] px-6 py-4 text-sm font-black text-[#07100a] transition hover:-translate-y-0.5 hover:brightness-105">Testar VetorCAD <ArrowRight size={17} /></Link></div></section>
      </main>
    </PublicSiteShell>
  );
}

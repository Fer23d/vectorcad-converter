import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileImage, ScanLine, Shapes, Download } from "lucide-react";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "Como funciona | VetorCAD",
  description: "Entenda como o VetorCAD transforma imagens e PDFs técnicos em arquivos SVG e DXF editáveis.",
  alternates: { canonical: "https://vetorcad.com.br/como-funciona" },
};

const steps = [
  { number: "01", title: "Enviar arquivo", text: "Imagem ou PDF técnico.", icon: FileImage },
  { number: "02", title: "Processamento inteligente", text: "Análise de linhas, formas e contornos.", icon: ScanLine },
  { number: "03", title: "Vetorização", text: "Conversão para elementos vetoriais.", icon: Shapes },
  { number: "04", title: "Exportação", text: "Arquivos SVG e DXF editáveis.", icon: Download },
];

const applications = [
  { title: "Arquitetura", text: "Prepare plantas, fachadas e desenhos técnicos para revisão e documentação." },
  { title: "Engenharia", text: "Organize diagramas, fluxogramas e materiais técnicos legados." },
  { title: "CNC e fabricação", text: "Leve contornos e geometrias para fluxos de corte e fabricação digital." },
];

export default function ComoFuncionaPage() {
  return (
    <PublicSiteShell>
      <main className="overflow-hidden">
        <section className="relative border-b border-[#1c2822] bg-[#070b09]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(183,243,74,.14),transparent_30%),linear-gradient(135deg,#070b09,#0b1510_55%,#070b09)]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-32">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[#b7f34a]/35 bg-[#b7f34a]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[.18em] text-[#b7f34a]">Fluxo VetorCAD</span>
              <h1 className="mt-7 text-5xl font-black leading-[1.02] tracking-[-.06em] md:text-7xl">Transforme desenhos técnicos em arquivos CAD editáveis</h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#b8c8c0]">O VetorCAD processa imagens e PDFs técnicos, organiza linhas e contornos e prepara uma base vetorial para seus próximos fluxos de engenharia.</p>
              <Link href="/signup" className="mt-9 inline-flex items-center gap-3 rounded-2xl bg-[#b7f34a] px-6 py-4 text-sm font-black text-[#07100a] transition hover:-translate-y-0.5 hover:brightness-105">Teste o VetorCAD <ArrowRight size={17} /></Link>
            </div>
            <div className="relative flex items-center justify-center">
              <div className="relative w-full max-w-md rounded-[2rem] border border-[#304238] bg-[#0d1411]/90 p-5 shadow-2xl shadow-black/30">
                <div className="mb-4 flex items-center justify-between border-b border-[#26382e] pb-4 text-[10px] font-black uppercase tracking-[.16em] text-[#90a39a]"><span className="text-[#b7f34a]">Processamento técnico</span><span>01 — 04</span></div>
                <div className="grid min-h-64 place-items-center rounded-2xl border border-[#1e2d25] bg-[linear-gradient(45deg,#101914_25%,transparent_25%),linear-gradient(-45deg,#101914_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#101914_75%),linear-gradient(-45deg,transparent_75%,#101914_75%)] bg-[length:28px_28px] bg-[position:0_0,0_14px,14px_-14px,-14px_0]">
                  <svg viewBox="0 0 360 220" className="w-full p-8" aria-label="Contornos técnicos sendo processados" role="img"><g fill="none" stroke="#b7f34a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M30 45h100v45h55V45h145v130H185v-38h-55v38H30z" /><path d="M130 45v45m55-45v45m0 47v38m55-130v130" /><circle cx="82" cy="110" r="25" /><path d="M57 110h50M82 85v50" /></g><g fill="#edf5f0" fontFamily="monospace" fontSize="10"><text x="45" y="70">PLANTA</text><text x="235" y="160">3500</text></g></svg>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-[#9eafa5]"><span>Imagem + PDF</span><span className="text-[#b7f34a]">SVG / DXF</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
          <div className="max-w-2xl"><span className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Como funciona</span><h2 className="mt-4 text-4xl font-black tracking-[-.05em] md:text-5xl">Do arquivo original ao vetor editável.</h2><p className="mt-5 text-lg leading-8 text-[#aebeb6]">Um fluxo direto para reduzir tarefas repetitivas e manter o controle sobre o resultado técnico.</p></div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{steps.map(({ number, title, text, icon: Icon }) => <article key={number} className="rounded-3xl border border-[#26382e] bg-[#0d1411] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#b7f34a]/60"><div className="flex items-start justify-between"><span className="text-3xl font-black text-[#b7f34a]/45">{number}</span><Icon className="text-[#b7f34a]" size={22} /></div><h3 className="mt-8 text-lg font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-[#9eafa5]">{text}</p></article>)}</div>
        </section>

        <section className="border-y border-[#1c2822] bg-[#0a0f0d]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
            <div><span className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Antes e depois</span><h2 className="mt-4 text-4xl font-black tracking-[-.05em] md:text-5xl">A mesma informação, pronta para editar.</h2><p className="mt-5 max-w-xl text-lg leading-8 text-[#aebeb6]">Revise o desenho original e o resultado vetorial antes de exportar para o software de destino.</p></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-3xl border border-[#26382e] bg-[#111915] p-5"><div className="mb-4 text-[10px] font-black uppercase tracking-[.16em] text-[#8ea098]">Arquivo original</div><div className="grid h-48 place-items-center rounded-2xl border border-[#304238] bg-white"><svg viewBox="0 0 220 140" className="w-full p-6" aria-label="Desenho original" role="img"><g fill="none" stroke="#6b756e" strokeWidth="2"><rect x="25" y="25" width="170" height="90" /><path d="M25 75h170M100 25v90" /><circle cx="62" cy="51" r="14" /></g></svg></div></div><div className="rounded-3xl border border-[#b7f34a]/45 bg-[#101a14] p-5"><div className="mb-4 text-[10px] font-black uppercase tracking-[.16em] text-[#b7f34a]">Resultado CAD</div><div className="grid h-48 place-items-center rounded-2xl border border-[#304238] bg-[#07100a]"><svg viewBox="0 0 220 140" className="w-full p-6" aria-label="Resultado CAD editável" role="img"><g fill="none" stroke="#b7f34a" strokeWidth="2"><rect x="25" y="25" width="170" height="90" /><path d="M25 75h170M100 25v90" /><circle cx="62" cy="51" r="14" /></g></svg></div></div></div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28"><div className="max-w-2xl"><span className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Aplicações</span><h2 className="mt-4 text-4xl font-black tracking-[-.05em] md:text-5xl">Feito para diferentes fluxos técnicos.</h2></div><div className="mt-10 grid gap-4 md:grid-cols-3">{applications.map((item) => <article key={item.title} className="rounded-3xl border border-[#26382e] bg-[#0d1411] p-7"><h3 className="text-xl font-black text-[#b7f34a]">{item.title}</h3><p className="mt-4 leading-7 text-[#aebeb6]">{item.text}</p></article>)}</div></section>

        <section className="border-t border-[#1c2822] bg-[#0a0f0d]"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-16 sm:flex-row sm:items-center lg:px-8"><div><h2 className="text-3xl font-black tracking-[-.04em]">Pronto para começar?</h2><p className="mt-3 text-[#aebeb6]">Envie uma imagem ou PDF técnico e teste o fluxo do VetorCAD.</p></div><Link href="/signup" className="inline-flex items-center gap-3 rounded-2xl bg-[#b7f34a] px-6 py-4 text-sm font-black text-[#07100a] transition hover:-translate-y-0.5 hover:brightness-105">Teste o VetorCAD <ArrowRight size={17} /></Link></div></section>
      </main>
    </PublicSiteShell>
  );
}

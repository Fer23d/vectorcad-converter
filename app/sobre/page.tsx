import type { Metadata } from "next";
import Link from "next/link";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "Sobre | VectorCAD",
  description: "Conheça o VectorCAD, plataforma SaaS para automação de processos de engenharia, análise de projetos e organização técnica.",
  alternates: { canonical: "https://vetorcad.com.br/sobre" },
};

const pillars = [
  ["Automação técnica", "Reduzimos tarefas repetitivas e ajudamos equipes a organizar informações de projeto com mais velocidade."],
  ["Engenharia aplicada", "O foco do VectorCAD é apoiar fluxos reais de análise, documentação, revisão e preparação técnica."],
  ["Workspace SaaS", "Projetos, usuários, planos e histórico evoluem em uma base centralizada, pronta para equipes e empresas."],
];

export default function SobrePage() {
  return (
    <PublicSiteShell>
      <section className="relative overflow-hidden border-b border-[#1c2822]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(183,243,74,.16),transparent_44%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 lg:px-8 lg:py-24">
          <div className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Sobre o VectorCAD</div>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-[-.04em] md:text-6xl">Tecnologia SaaS para organizar e acelerar projetos de engenharia</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#b8c8c0]">
            VectorCAD é uma plataforma SaaS criada para automatizar processos de engenharia, análise de projetos e organização técnica. A proposta é unir engenharia, automação e inteligência para transformar arquivos e informações técnicas em fluxos mais claros, rastreáveis e produtivos.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-2xl bg-[#b7f34a] px-6 py-4 text-sm font-black text-[#07100a] transition hover:brightness-105">Criar workspace</Link>
            <Link href="/contato" className="rounded-2xl border border-[#304238] px-6 py-4 text-sm font-black text-[#edf5f0] transition hover:bg-[#111915]">Falar com o time</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map(([title, text]) => (
            <article key={title} className="rounded-3xl border border-[#223028] bg-[#0d1411] p-6">
              <div className="mb-4 h-2 w-12 rounded-full bg-[#b7f34a]" />
              <h2 className="text-xl font-black text-[#edf5f0]">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#aebeb6]">{text}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-[2rem] border border-[#223028] bg-[#0a0f0d] p-8">
          <h2 className="text-2xl font-black">Criado para empresas que precisam de clareza técnica</h2>
          <p className="mt-4 max-w-4xl leading-7 text-[#aebeb6]">
            O VectorCAD foi pensado para apoiar profissionais, equipes e empresas que lidam com arquivos técnicos, revisões, conversões, relatórios e organização de projetos. A plataforma cresce com foco em confiabilidade, segurança, produtividade e experiência moderna.
          </p>
          <div className="mt-6">
            <p className="text-sm font-black text-[#b7f34a]">Grupo ShiftCore</p>
            <p className="mt-1 text-xs leading-5 text-[#94a49c]">Tecnologia, inovação e soluções inteligentes.</p>
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
}

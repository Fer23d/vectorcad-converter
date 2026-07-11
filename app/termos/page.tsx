import type { Metadata } from "next";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "Termos de Uso | VectorCAD",
  description: "Termos de uso do VectorCAD para clientes, empresas e usuarios da plataforma SaaS.",
  alternates: { canonical: "https://vetorcad.com.br/termos" },
};

const sections = [
  {
    title: "Sobre a plataforma",
    text: "O VectorCAD e uma plataforma SaaS criada para apoiar processos de engenharia, analise tecnica, organizacao de projetos e automacao de fluxos digitais relacionados a arquivos, imagens e dados tecnicos.",
  },
  {
    title: "Uso permitido",
    text: "O usuario pode utilizar a plataforma para criar, organizar, analisar e gerenciar projetos proprios ou materiais para os quais possua autorizacao. E proibido usar o sistema para atividades ilegais, violacao de direitos de terceiros ou tentativa de comprometer a seguranca da aplicacao.",
  },
  {
    title: "Responsabilidade do usuario",
    text: "O usuario e responsavel pelas informacoes enviadas, pela revisao tecnica dos resultados e pela verificacao de medidas, escalas, dados e arquivos antes de qualquer uso profissional, industrial ou comercial.",
  },
  {
    title: "Propriedade intelectual",
    text: "A marca VectorCAD, a interface, os fluxos, textos, componentes, codigos e recursos da plataforma pertencem aos seus respectivos titulares. O usuario mantem a responsabilidade e os direitos sobre os arquivos e dados que enviar, observadas as leis aplicaveis.",
  },
  {
    title: "Limitacao de responsabilidade",
    text: "Embora o VectorCAD busque entregar resultados confiaveis, a plataforma pode depender da qualidade dos arquivos enviados e de fatores externos. O servico nao substitui validacao tecnica profissional quando o projeto exigir precisao, seguranca ou conformidade normativa.",
  },
  {
    title: "Cancelamento",
    text: "Planos, acessos e assinaturas podem ser cancelados conforme as regras comerciais vigentes. Recursos pagos podem ficar indisponiveis apos cancelamento, inadimplencia ou encerramento do periodo contratado.",
  },
];

export default function TermosPage() {
  return (
    <PublicSiteShell>
      <section className="relative overflow-hidden border-b border-[#1c2822]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(183,243,74,.16),transparent_44%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 lg:px-8 lg:py-20">
          <div className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Legal</div>
          <h1 className="mt-4 text-4xl font-black tracking-[-.04em] md:text-6xl">Termos de Uso</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#b8c8c0]">
            Estes termos definem as regras de uso do VectorCAD e ajudam a manter uma relacao transparente com usuarios, equipes tecnicas e clientes empresariais.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 lg:px-8">
        <div className="grid gap-5">
          {sections.map((section) => (
            <article key={section.title} className="rounded-3xl border border-[#223028] bg-[#0d1411] p-6 shadow-xl shadow-black/10">
              <h2 className="text-xl font-black text-[#edf5f0]">{section.title}</h2>
              <p className="mt-3 leading-7 text-[#aebeb6]">{section.text}</p>
            </article>
          ))}
        </div>
      </section>
    </PublicSiteShell>
  );
}

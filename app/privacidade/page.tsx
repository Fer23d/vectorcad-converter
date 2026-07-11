import type { Metadata } from "next";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "Politica de Privacidade | VectorCAD",
  description: "Politica de privacidade do VectorCAD, incluindo dados coletados, uso, seguranca, cookies e direitos LGPD.",
  alternates: { canonical: "https://vetorcad.com.br/privacidade" },
};

const sections = [
  {
    title: "Dados coletados",
    text: "Podemos coletar dados de cadastro, como nome, email, identificador de usuario, empresa informada, dados de sessao, registros de uso, projetos criados e informacoes tecnicas necessarias para operar a plataforma.",
  },
  {
    title: "Como usamos os dados",
    text: "Usamos os dados para autenticar usuarios, salvar projetos, manter o workspace, enviar comunicacoes transacionais, controlar limites de uso, processar pagamentos, melhorar a experiencia e proteger a plataforma contra abuso.",
  },
  {
    title: "Armazenamento e seguranca",
    text: "Os dados podem ser armazenados em provedores de infraestrutura e banco de dados utilizados pelo VectorCAD. Aplicamos medidas tecnicas e organizacionais para reduzir riscos de acesso indevido, perda ou alteracao nao autorizada.",
  },
  {
    title: "Cookies",
    text: "Podemos usar cookies e tecnologias semelhantes para manter sessoes, medir desempenho, melhorar navegacao e, em paginas publicas, viabilizar recursos de publicidade ou analise conforme configuracao do site.",
  },
  {
    title: "Direitos LGPD",
    text: "Nos termos da LGPD, o titular pode solicitar confirmacao de tratamento, acesso, correcao, portabilidade, anonimizar, bloquear ou eliminar dados, alem de solicitar informacoes sobre compartilhamento quando aplicavel.",
  },
  {
    title: "Exclusao de dados",
    text: "O usuario pode solicitar exclusao de dados pessoais e projetos vinculados a sua conta. Algumas informacoes podem ser mantidas temporariamente quando necessarias para cumprimento legal, seguranca, auditoria ou prevencao a fraude.",
  },
];

export default function PrivacidadePage() {
  return (
    <PublicSiteShell>
      <section className="relative overflow-hidden border-b border-[#1c2822]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(183,243,74,.16),transparent_44%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 lg:px-8 lg:py-20">
          <div className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Privacidade e LGPD</div>
          <h1 className="mt-4 text-4xl font-black tracking-[-.04em] md:text-6xl">Politica de Privacidade</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#b8c8c0]">
            Esta politica explica como o VectorCAD trata dados pessoais e informacoes tecnicas para operar uma plataforma SaaS segura, profissional e preparada para clientes empresariais.
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

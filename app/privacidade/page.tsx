import type { Metadata } from "next";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "Política de Privacidade | vetorcad",
  description: "Política de privacidade do vetorcad, incluindo dados coletados, uso, segurança, cookies e direitos LGPD.",
  alternates: { canonical: "https://vetorcad.com.br/privacidade" },
};

const sections = [
  {
    title: "Dados coletados",
    text: "Podemos coletar dados de cadastro, como nome, e-mail, identificador de usuário, empresa informada, dados de sessão, registros de uso, projetos criados e informações técnicas necessárias para operar a plataforma.",
  },
  {
    title: "Como usamos os dados",
    text: "Usamos os dados para autenticar usuários, salvar projetos, manter o workspace, enviar comunicações transacionais, controlar limites de uso, processar pagamentos, melhorar a experiência e proteger a plataforma contra abuso.",
  },
  {
    title: "Arquivos CAD enviados",
    text: "Arquivos CAD, imagens e dados técnicos enviados podem ser processados para entregar os recursos contratados, como análise, organização, conversão, visualização e exportação. O usuário é responsável pelos arquivos enviados e declara possuir autorização para utilização desses arquivos.",
  },
  {
    title: "Armazenamento e segurança",
    text: "Os dados podem ser armazenados em provedores de infraestrutura e banco de dados utilizados pelo vetorcad. Aplicamos medidas técnicas e organizacionais para reduzir riscos de acesso indevido, perda ou alteração não autorizada.",
  },
  {
    title: "Cookies",
    text: "Podemos usar cookies e tecnologias semelhantes para manter sessões, medir desempenho, melhorar navegação e, em páginas públicas, viabilizar recursos de publicidade ou análise conforme a configuração do site.",
  },
  {
    title: "Direitos LGPD",
    text: "Nos termos da LGPD, o titular pode solicitar confirmação de tratamento, acesso, correção, portabilidade, anonimização, bloqueio ou eliminação de dados, além de informações sobre compartilhamento quando aplicável.",
  },
  {
    title: "Exclusão de dados",
    text: "O usuário pode solicitar exclusão de dados pessoais e projetos vinculados à sua conta. Algumas informações podem ser mantidas temporariamente quando necessárias para cumprimento legal, segurança, auditoria ou prevenção a fraude.",
  },
];

export default function PrivacidadePage() {
  return (
    <PublicSiteShell>
      <section className="relative overflow-hidden border-b border-[#1c2822]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(183,243,74,.16),transparent_44%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 lg:px-8 lg:py-20">
          <div className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Privacidade e LGPD</div>
          <h1 className="mt-4 text-4xl font-black tracking-[-.04em] md:text-6xl">Política de Privacidade</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#b8c8c0]">
            Esta política explica como o vetorcad trata dados pessoais e informações técnicas para operar uma plataforma SaaS segura, profissional e preparada para clientes empresariais.
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

import type { Metadata } from "next";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "Politica de Privacidade | VectorCAD",
  description: "Politica de privacidade do VectorCAD Converter, incluindo dados de conta, projetos, pagamentos e publicidade.",
  alternates: { canonical: "https://vetorcad.com.br/politica-de-privacidade" },
};

const sections = [
  ["Dados coletados", "Podemos coletar email, identificador de usuario, informacoes de perfil, dados de projetos criados no app, registros de uso e informacoes tecnicas necessarias para seguranca, autenticao e funcionamento do servico."],
  ["Uso das informacoes", "Usamos os dados para autenticar usuarios, salvar projetos, controlar limites de uso, processar pagamentos, melhorar a ferramenta e proteger o sistema contra abuso."],
  ["Arquivos enviados", "Imagens enviadas para conversao sao usadas para gerar previews, SVG, DXF e recursos relacionados ao projeto. O usuario deve evitar enviar arquivos que nao possui direito de usar."],
  ["Pagamentos", "Pagamentos podem ser processados por parceiros como Mercado Pago. Dados sensiveis de cartao nao sao armazenados diretamente pelo VectorCAD."],
  ["Publicidade", "Podemos usar Google AdSense apenas em paginas publicas com conteudo editorial. Areas privadas como dashboard, editor, perfil e admin nao devem carregar anuncios do Google."],
  ["Contato", "Para duvidas sobre privacidade, use a pagina de contato do site."],
];

export default function PrivacyPage() {
  return (
    <PublicSiteShell>
      <section className="mx-auto max-w-4xl px-4 py-16 lg:px-8">
        <div className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Legal</div>
        <h1 className="mt-4 text-4xl font-black tracking-[-.04em] md:text-5xl">Politica de Privacidade</h1>
        <p className="mt-5 leading-7 text-[#aebeb6]">Esta politica explica como o VectorCAD Converter trata dados para operar o SaaS, salvar projetos e oferecer recursos de conversao CAD.</p>
        <div className="mt-10 space-y-5">
          {sections.map(([title, text]) => (
            <section key={title} className="rounded-3xl border border-[#223028] bg-[#0d1411] p-6">
              <h2 className="text-xl font-black">{title}</h2>
              <p className="mt-3 leading-7 text-[#aebeb6]">{text}</p>
            </section>
          ))}
        </div>
      </section>
    </PublicSiteShell>
  );
}

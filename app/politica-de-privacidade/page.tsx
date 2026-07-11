import type { Metadata } from "next";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "Política de Privacidade | VectorCAD",
  description: "Política de privacidade do VectorCAD Converter, incluindo dados de conta, projetos, pagamentos e publicidade.",
  alternates: { canonical: "https://vetorcad.com.br/politica-de-privacidade" },
};

const sections = [
  ["Dados coletados", "Podemos coletar e-mail, identificador de usuário, informações de perfil, dados de projetos criados no aplicativo, registros de uso e informações técnicas necessárias para segurança, autenticação e funcionamento do serviço."],
  ["Uso das informações", "Usamos os dados para autenticar usuários, salvar projetos, controlar limites de uso, processar pagamentos, melhorar a ferramenta e proteger o sistema contra abuso."],
  ["Arquivos enviados", "Imagens enviadas para conversão são usadas para gerar previews, SVG, DXF e recursos relacionados ao projeto. O usuário é responsável pelos arquivos enviados e declara possuir autorização para utilização desses arquivos."],
  ["Pagamentos", "Pagamentos podem ser processados por parceiros como o Mercado Pago. Dados sensíveis de cartão não são armazenados diretamente pelo VectorCAD."],
  ["Publicidade", "Podemos usar Google AdSense apenas em páginas públicas com conteúdo editorial. Áreas privadas como dashboard, editor, perfil e admin não devem carregar anúncios do Google."],
  ["Contato", "Para dúvidas sobre privacidade, use a página de contato do site."],
];

export default function PrivacyPage() {
  return (
    <PublicSiteShell>
      <section className="mx-auto max-w-4xl px-4 py-16 lg:px-8">
        <div className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Legal</div>
        <h1 className="mt-4 text-4xl font-black tracking-[-.04em] md:text-5xl">Política de Privacidade</h1>
        <p className="mt-5 leading-7 text-[#aebeb6]">Esta política explica como o VectorCAD Converter trata dados para operar o SaaS, salvar projetos e oferecer recursos de conversão CAD.</p>
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

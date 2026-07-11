import type { Metadata } from "next";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "Termos de Uso | VectorCAD",
  description: "Termos de uso do VectorCAD Converter para conversao de imagens em SVG, DXF e modelos 3D.",
  alternates: { canonical: "https://vetorcad.com.br/termos-de-uso" },
};

const terms = [
  ["Uso permitido", "O usuario pode usar o VectorCAD para converter imagens proprias ou imagens que tenha autorizacao para processar."],
  ["Limites da vetorizacao", "A conversao automatica depende da qualidade da imagem. Arquivos complexos podem exigir revisao manual antes de uso em producao, corte ou fabricacao."],
  ["Responsabilidade tecnica", "Antes de enviar um arquivo para usinagem, corte, impressao 3D ou obra tecnica, confira medidas, escala, contornos e compatibilidade no software de destino."],
  ["Planos e pagamentos", "Recursos, limites de uso e exportacoes podem variar conforme o plano ativo. Pagamentos aprovados podem liberar recursos pagos automaticamente."],
  ["Conta e seguranca", "O usuario e responsavel por manter suas credenciais seguras e por nao compartilhar acesso de forma indevida."],
  ["Alteracoes", "Os termos podem ser atualizados para refletir melhorias do produto, novas funcionalidades e exigencias legais."],
];

export default function TermsPage() {
  return (
    <PublicSiteShell>
      <section className="mx-auto max-w-4xl px-4 py-16 lg:px-8">
        <div className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Legal</div>
        <h1 className="mt-4 text-4xl font-black tracking-[-.04em] md:text-5xl">Termos de Uso</h1>
        <p className="mt-5 leading-7 text-[#aebeb6]">Ao usar o VectorCAD Converter, voce concorda com estes termos e entende que resultados tecnicos devem ser revisados antes de producao.</p>
        <div className="mt-10 space-y-5">
          {terms.map(([title, text]) => (
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

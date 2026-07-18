import type { Metadata } from "next";
import Link from "next/link";
import { PublicSiteShell } from "@/components/public-site-shell";
import { blogArticles } from "@/lib/public-content";

export const metadata: Metadata = {
  title: "Blog VetorCAD | Guias de SVG, DXF, CAD e CNC",
  description: "Artigos sobre vetorização, conversão de imagem para DXF, SVG para corte laser, CAD/CAM e preparação de arquivos técnicos.",
  alternates: { canonical: "https://vetorcad.com.br/blog" },
};

export default function BlogPage() {
  return (
    <PublicSiteShell>
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <div className="max-w-3xl">
          <div className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Blog técnico</div>
          <h1 className="mt-4 text-4xl font-black tracking-[-.04em] md:text-6xl">Artigos sobre imagem, vetor e CAD</h1>
          <p className="mt-5 text-lg leading-8 text-[#aebeb6]">Guias preparados para quem precisa transformar imagens em arquivos editáveis, reduzir retrabalho e entender melhor os limites da vetorização automática.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {blogArticles.map((article) => (
            <Link key={article.slug} href={`/blog/${article.slug}`} className="rounded-3xl border border-[#223028] bg-[#0d1411] p-6 transition hover:-translate-y-1 hover:border-[#b7f34a]/60">
              <div className="text-[10px] font-black uppercase tracking-[.16em] text-[#b7f34a]">{article.category}</div>
              <h2 className="mt-4 text-2xl font-black leading-tight">{article.title}</h2>
              <p className="mt-4 text-sm leading-6 text-[#aebeb6]">{article.description}</p>
              <div className="mt-6 text-xs text-[#7f9188]">{article.date} · {article.readTime}</div>
            </Link>
          ))}
        </div>
      </section>
    </PublicSiteShell>
  );
}

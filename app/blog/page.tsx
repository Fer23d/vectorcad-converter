import type { Metadata } from "next";
import Link from "next/link";
import { PublicSiteShell } from "@/components/public-site-shell";
import { blogArticles } from "@/lib/public-content";

export const metadata: Metadata = {
  title: "Blog VetorCAD | Guias, novidades do aplicativo, PDF, SVG, DXF e CAD",
  description: "Artigos, atualizações do aplicativo e guias sobre vetorização, PDF para DXF, SVG, CAD/CAM, CNC e preparação de arquivos técnicos.",
  alternates: { canonical: "https://vetorcad.com.br/blog" },
};

export default function BlogPage() {
  const featuredArticle = blogArticles.find((article) => article.featured);
  const articles = featuredArticle ? blogArticles.filter((article) => article.slug !== featuredArticle.slug) : blogArticles;
  const categories = Array.from(new Set(["VetorCAD", "Aplicativo", "Atualizações", "Tutoriais", "CAD", "Engenharia", ...blogArticles.map((article) => article.category)]));

  return (
    <PublicSiteShell>
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <div className="max-w-3xl">
          <div className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Blog técnico</div>
          <h1 className="mt-4 text-4xl font-black tracking-[-.04em] md:text-6xl">Artigos, tutoriais e novidades do VetorCAD</h1>
          <p className="mt-5 text-lg leading-8 text-[#aebeb6]">Guias preparados para quem precisa transformar imagens e PDFs em arquivos editáveis, acompanhar atualizações do aplicativo e entender melhor fluxos técnicos de CAD.</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          {categories.map((category) => <span key={category} className="rounded-full border border-[#26312c] bg-[#0d1411] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] text-[#9eb0a6]">
            {category}
          </span>)}
        </div>

        {featuredArticle && <Link href={`/blog/${featuredArticle.slug}`} className="mt-12 grid overflow-hidden rounded-[2rem] border border-[#b7f34a]/35 bg-[radial-gradient(circle_at_top_left,rgba(183,243,74,.16),rgba(13,20,17,.94)_45%,#070b09)] p-6 transition hover:-translate-y-1 hover:border-[#b7f34a]/70 md:grid-cols-[1fr_.7fr] md:p-8">
          <div>
            <div className="inline-flex rounded-full border border-[#b7f34a]/35 bg-[#172314] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-[#b7f34a]">
              Destaque · {featuredArticle.category}
            </div>
            <h2 className="mt-5 max-w-3xl text-3xl font-black leading-tight tracking-[-.04em] md:text-5xl">{featuredArticle.title}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#c7d6ce]">{featuredArticle.description}</p>
            <div className="mt-6 inline-flex rounded-xl bg-[#b7f34a] px-5 py-3 text-xs font-black text-[#09120d]">
              {featuredArticle.ctaLabel || "Ler artigo"}
            </div>
          </div>
          <div className="mt-8 rounded-3xl border border-[#b7f34a]/20 bg-[#0a0f0d]/70 p-5 md:mt-0">
            <div className="text-[10px] font-black uppercase tracking-[.18em] text-[#728178]">VetorCAD</div>
            <div className="mt-4 text-4xl font-black tracking-[-.06em] text-white">APP</div>
            <div className="mt-5 h-px bg-gradient-to-r from-[#b7f34a] to-transparent" />
            <p className="mt-5 text-sm leading-6 text-[#aebeb6]">Agora também disponível como aplicativo.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {(featuredArticle.tags || []).map((tag) => <span key={tag} className="rounded-full border border-[#34413b] px-2.5 py-1 text-[10px] font-black text-[#9eb0a6]">{tag}</span>)}
            </div>
          </div>
        </Link>}

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {articles.map((article) => (
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

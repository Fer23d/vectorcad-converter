import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicSiteShell } from "@/components/public-site-shell";
import { blogArticles, getArticle } from "@/lib/public-content";

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return blogArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  return {
    title: `${article.title} | VectorCAD`,
    description: article.description,
    alternates: { canonical: `https://vetorcad.com.br/blog/${article.slug}` },
  };
}

export default async function BlogArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  return (
    <PublicSiteShell>
      <article className="mx-auto max-w-3xl px-4 py-16 lg:px-0">
        <Link href="/blog" className="text-sm font-black text-[#b7f34a]">Voltar ao blog</Link>
        <div className="mt-8 text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">{article.category} · {article.readTime}</div>
        <h1 className="mt-4 text-4xl font-black leading-tight tracking-[-.04em] md:text-6xl">{article.title}</h1>
        <p className="mt-6 text-lg leading-8 text-[#aebeb6]">{article.description}</p>
        <div className="mt-4 text-sm text-[#7f9188]">Publicado em {article.date}</div>
        <div className="mt-12 space-y-10">
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-black tracking-[-.02em]">{section.heading}</h2>
              <div className="mt-4 space-y-4">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="leading-8 text-[#b8c8c0]">{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </PublicSiteShell>
  );
}

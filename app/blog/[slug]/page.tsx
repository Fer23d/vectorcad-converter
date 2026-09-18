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
    title: article.metaTitle || article.title,
    description: article.metaDescription || article.description,
    keywords: article.keywords,
    alternates: { canonical: `https://vetorcad.com.br/blog/${article.slug}` },
    openGraph: {
      title: article.metaTitle || article.title,
      description: article.metaDescription || article.description,
      url: `https://vetorcad.com.br/blog/${article.slug}`,
      type: "article",
      publishedTime: article.date,
      siteName: "VetorCAD",
      images: article.image ? [{ url: article.image, alt: article.title }] : undefined,
    },
    twitter: {
      card: article.image ? "summary_large_image" : "summary",
      title: article.metaTitle || article.title,
      description: article.metaDescription || article.description,
      images: article.image ? [article.image] : undefined,
    },
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
        {article.subtitle && <div className="mt-4 inline-flex rounded-full border border-[#34413b] bg-[#0d1411] px-3 py-1.5 text-xs font-black uppercase tracking-[.14em] text-[#b7f34a]">{article.subtitle}</div>}
        <p className="mt-6 text-lg leading-8 text-[#aebeb6]">{article.description}</p>
        <div className="mt-4 text-sm text-[#7f9188]">Publicado em {article.date}</div>
        {article.ctaHref && article.ctaLabel && <Link href={article.ctaHref} className="mt-8 inline-flex rounded-xl bg-[#b7f34a] px-5 py-3 text-xs font-black text-[#09120d] transition hover:brightness-105">
          {article.ctaLabel}
        </Link>}
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

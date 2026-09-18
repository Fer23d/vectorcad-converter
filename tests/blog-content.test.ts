import { describe, expect, it } from "vitest";
import { blogArticles, getArticle } from "@/lib/public-content";

describe("public blog content", () => {
  it("includes a featured article for the VetorCAD app launch", () => {
    const article = getArticle("vetorcad-agora-tambem-como-aplicativo");

    expect(article).toBeDefined();
    expect(article?.category).toBe("Aplicativo");
    expect(article?.featured).toBe(true);
    expect(article?.ctaLabel).toBe("Conhecer o aplicativo");
    expect(article?.ctaHref).toBe("/login");
  });

  it("keeps the app launch as the first featured article", () => {
    const featured = blogArticles.filter((article) => article.featured);

    expect(featured[0]?.slug).toBe("vetorcad-agora-tambem-como-aplicativo");
  });
});

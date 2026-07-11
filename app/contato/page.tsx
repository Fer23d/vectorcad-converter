import type { Metadata } from "next";
import Link from "next/link";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "Contato | VectorCAD",
  description: "Entre em contato com o VectorCAD para suporte, parcerias, planos empresariais e dúvidas sobre projetos de engenharia.",
  alternates: { canonical: "https://vetorcad.com.br/contato" },
};

export default function ContatoPage() {
  return (
    <PublicSiteShell>
      <section className="relative overflow-hidden border-b border-[#1c2822]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(183,243,74,.16),transparent_44%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-16 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:py-20">
          <div>
            <div className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Contato</div>
            <h1 className="mt-4 text-4xl font-black tracking-[-.04em] md:text-6xl">Fale com o VectorCAD</h1>
            <p className="mt-6 text-lg leading-8 text-[#b8c8c0]">
              Envie uma mensagem para suporte, parcerias, implantação em empresas, planos SaaS ou dúvidas sobre organização e análise de projetos de engenharia.
            </p>
            <div className="mt-8 grid gap-4 text-sm text-[#aebeb6]">
              <a href="mailto:contato@vetorcad.com.br" className="rounded-2xl border border-[#304238] bg-[#0d1411] p-5 transition hover:border-[#b7f34a]/60">
                <span className="block text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">Email</span>
                <span className="mt-2 block text-lg font-black text-[#edf5f0]">contato@vetorcad.com.br</span>
              </a>
              <Link href="/signup" className="rounded-2xl border border-[#304238] bg-[#0d1411] p-5 transition hover:border-[#b7f34a]/60">
                <span className="block text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">Workspace</span>
                <span className="mt-2 block text-lg font-black text-[#edf5f0]">Criar conta no VectorCAD</span>
              </Link>
            </div>
          </div>

          <form action="mailto:contato@vetorcad.com.br" method="post" encType="text/plain" className="rounded-[2rem] border border-[#223028] bg-[#0d1411] p-6 shadow-2xl shadow-black/30 md:p-8">
            <h2 className="text-2xl font-black">Envie sua mensagem</h2>
            <p className="mt-3 text-sm leading-6 text-[#93a39b]">Preencha os campos abaixo. Seu aplicativo de e-mail será aberto com a mensagem pronta para envio.</p>

            <label className="mt-6 block text-xs font-black uppercase tracking-[.14em] text-[#b7f34a]">
              Nome
              <input name="nome" required className="mt-2 w-full rounded-2xl border border-[#304238] bg-[#050807] px-4 py-3 text-sm text-[#edf5f0] outline-none transition placeholder:text-[#617169] focus:border-[#b7f34a]" placeholder="Seu nome" />
            </label>

            <label className="mt-5 block text-xs font-black uppercase tracking-[.14em] text-[#b7f34a]">
              Email
              <input name="email" type="email" required className="mt-2 w-full rounded-2xl border border-[#304238] bg-[#050807] px-4 py-3 text-sm text-[#edf5f0] outline-none transition placeholder:text-[#617169] focus:border-[#b7f34a]" placeholder="nome@empresa.com.br" />
            </label>

            <label className="mt-5 block text-xs font-black uppercase tracking-[.14em] text-[#b7f34a]">
              Mensagem
              <textarea name="mensagem" required rows={6} className="mt-2 w-full resize-none rounded-2xl border border-[#304238] bg-[#050807] px-4 py-3 text-sm text-[#edf5f0] outline-none transition placeholder:text-[#617169] focus:border-[#b7f34a]" placeholder="Conte como podemos ajudar..." />
            </label>

            <button className="mt-6 w-full rounded-2xl bg-[#b7f34a] px-5 py-4 text-sm font-black text-[#07100a] transition hover:brightness-105">
              Enviar mensagem
            </button>
          </form>
        </div>
      </section>
    </PublicSiteShell>
  );
}

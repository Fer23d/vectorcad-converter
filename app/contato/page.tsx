import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "Contato | VetorCAD",
  description: "Entre em contato com o VetorCAD para suporte, parcerias, planos empresariais e dúvidas sobre projetos de engenharia.",
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
            <h1 className="mt-4 text-4xl font-black tracking-[-.04em] md:text-6xl">Fale com o VetorCAD</h1>
            <p className="mt-6 text-lg leading-8 text-[#b8c8c0]">
              Envie uma mensagem para suporte, parcerias, implantação em empresas, planos SaaS ou dúvidas sobre organização e análise de projetos de engenharia.
            </p>
            <div className="mt-8 grid gap-4 text-sm text-[#aebeb6]">
              <div className="rounded-2xl border border-[#304238] bg-[#0d1411] p-5">
                <span className="block text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">Email</span>
                <span className="mt-2 block text-lg font-black text-[#edf5f0]">contato@vetorcad.com.br</span>
              </div>
              <Link href="/signup" className="rounded-2xl border border-[#304238] bg-[#0d1411] p-5 transition hover:border-[#b7f34a]/60">
                <span className="block text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">Workspace</span>
                <span className="mt-2 block text-lg font-black text-[#edf5f0]">Criar conta no VetorCAD</span>
              </Link>
            </div>
          </div>
          <ContactForm />
        </div>
      </section>
    </PublicSiteShell>
  );
}


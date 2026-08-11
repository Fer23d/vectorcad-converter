import type { Metadata } from "next";
import { Mail, MessageCircle, Building2, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "Contato | VetorCAD",
  description: "Fale com a equipe VectorCAD sobre suporte, planos, implantação e soluções para equipes de engenharia.",
  alternates: { canonical: "https://vetorcad.com.br/contato" },
};

const contactBlocks = [
  { icon: Mail, label: "Email", title: "contato@vetorcad.com.br", text: "Envie sua dúvida diretamente para nossa equipe." },
  { icon: MessageCircle, label: "Suporte", title: "Ajuda com a plataforma", text: "Orientação sobre utilização, vetorização e arquivos CAD." },
  { icon: Building2, label: "Empresas", title: "Implantação e soluções", text: "Condições e fluxos para equipes técnicas e operações." },
];

export default function ContatoPage() {
  return <PublicSiteShell><section className="relative overflow-hidden border-b border-[#1c2822]"><div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(183,243,74,.13),transparent_32%),linear-gradient(135deg,#070b09,#0b1510_52%,#070b09)]" /><div className="absolute right-[12%] top-24 hidden h-48 w-48 rounded-full border border-[#b7f34a]/10 lg:block" /><div className="absolute right-[14%] top-32 hidden h-32 w-32 rounded-full border border-[#b7f34a]/10 lg:block" />
    <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[.85fr_1.15fr] lg:px-8 lg:py-24">
      <div className="admin-card-enter flex flex-col justify-center"><div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#b7f34a]/35 bg-[#b7f34a]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-[#b7f34a]">VetorCAD · contato</div><h1 className="mt-6 max-w-xl text-4xl font-black leading-[1.05] tracking-[-.05em] md:text-6xl">Fale com a equipe VectorCAD</h1><p className="mt-6 max-w-lg text-lg leading-8 text-[#b8c8c0]">Entre em contato para tirar dúvidas sobre a plataforma, planos, implantação e suporte.</p><div className="mt-8 grid gap-3">{contactBlocks.map(({ icon: Icon, label, title, text }) => <div key={label} className="group rounded-2xl border border-[#304238] bg-[#0d1411]/80 p-5 transition duration-300 hover:-translate-y-1 hover:border-[#b7f34a]/60 hover:bg-[#111b15]"><div className="flex items-start gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#b7f34a]/10 text-[#b7f34a]"><Icon size={19} /></div><div><div className="text-[10px] font-black uppercase tracking-[.16em] text-[#b7f34a]">{label}</div><div className="mt-1 text-base font-black text-[#edf5f0]">{title}</div><p className="mt-1 text-xs leading-5 text-[#8ea098]">{text}</p></div><ArrowUpRight size={16} className="ml-auto text-[#53645a] transition group-hover:text-[#b7f34a]" /></div></div>)}</div><Link href="/signup" className="mt-6 inline-flex w-fit items-center gap-2 text-sm font-black text-[#b7f34a] transition hover:gap-3">Comece a vetorização <ArrowUpRight size={16} /></Link></div>
      <ContactForm />
    </div>
  </section></PublicSiteShell>;
}

import Link from "next/link";
import type { ReactNode } from "react";
import { PublicAdSenseScript } from "@/components/public-adsense-script";

const navItems = [
  { href: "/", label: "Inicio" },
  { href: "/blog", label: "Blog" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
];

export function PublicSiteShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#070b09] text-[#edf5f0]">
      <PublicAdSenseScript />
      <header className="sticky top-0 z-20 border-b border-[#1c2822]/90 bg-[#070b09]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#b7f34a] text-sm font-black text-[#07100a]">VC</span>
            <span>
              <span className="block text-sm font-black tracking-[.12em]">VectorCAD</span>
              <span className="block text-[10px] uppercase tracking-[.22em] text-[#8ea098]">Converter</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-full px-4 py-2 text-xs font-bold text-[#b8c8c0] transition hover:bg-[#111915] hover:text-[#b7f34a]">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-xl border border-[#304238] px-4 py-2 text-xs font-black text-[#dce8e2] transition hover:bg-[#111915]">Entrar</Link>
            <Link href="/signup" className="rounded-xl bg-[#b7f34a] px-4 py-2 text-xs font-black text-[#07100a] transition hover:brightness-105">Criar conta</Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-[#1c2822] bg-[#050807]">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
          <div className="flex flex-col items-center justify-center gap-6 text-center text-sm text-[#94a49c] md:flex-row md:gap-8">
            <div className="max-w-xs">
              <div className="text-lg font-black tracking-[.12em] text-[#b7f34a]">VectorCAD</div>
              <p className="mt-3 leading-6">A inteligência aplicada aos seus projetos de engenharia.</p>
            </div>
            <div className="mx-auto hidden h-16 w-px bg-[#304238] md:block" aria-hidden="true" />
            <div className="max-w-xs">
              <div className="text-sm font-black tracking-[.08em] text-[#b7f34a]">Grupo ShiftCore</div>
              <p className="mt-2 text-xs leading-5">Tecnologia, inovação e soluções inteligentes.</p>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-8 border-t border-[#1c2822] pt-8 text-center text-sm text-[#94a49c] sm:flex-row sm:items-start sm:gap-16">
            <div className="grid justify-items-center gap-2">
              <div className="font-black text-[#edf5f0]">Institucional</div>
              <Link href="/blog" className="hover:text-[#b7f34a]">Blog</Link>
              <Link href="/sobre" className="hover:text-[#b7f34a]">Sobre</Link>
              <Link href="/contato" className="hover:text-[#b7f34a]">Contato</Link>
            </div>
            <div className="grid justify-items-center gap-2">
              <div className="font-black text-[#edf5f0]">Legal</div>
              <Link href="/termos" className="hover:text-[#b7f34a]">Termos de Uso</Link>
              <Link href="/privacidade" className="hover:text-[#b7f34a]">Política de Privacidade</Link>
              <Link href="/contato" className="hover:text-[#b7f34a]">Contato</Link>
              <Link href="/ads.txt" className="hover:text-[#b7f34a]">ads.txt</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

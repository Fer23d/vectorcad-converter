"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Box, FolderOpen, Home } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export default function NotFound() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) return;

    client.auth.getSession().then(({ data }) => {
      setIsAuthenticated(Boolean(data.session?.user));
    }).catch(() => setIsAuthenticated(false));
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#070b09] px-5 py-8 text-[#edf5f0]">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-[#b7f34a]/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(183,243,74,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(183,243,74,.05)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-[#304238] bg-[#101613]/95 p-7 shadow-2xl shadow-black/40 backdrop-blur md:p-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <Link href="/" className="inline-flex items-center gap-3 rounded-2xl border border-[#304238] bg-[#070b09] px-4 py-3 text-sm font-black text-[#dce8e2] transition hover:border-[#b7f34a]/60 hover:text-[#b7f34a]">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#b7f34a] text-xs text-[#07100a]">VC</span>
                VetorCAD
              </Link>

              <div className="mt-10 inline-flex rounded-full border border-[#b7f34a]/40 bg-[#b7f34a]/10 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">
                Erro 404
              </div>
              <h1 className="mt-5 text-4xl font-black leading-tight tracking-[-.05em] md:text-6xl">
                Esta rota saiu do desenho.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#aebeb6] md:text-lg">
                O endereço acessado não existe ou foi movido. Você pode voltar para a página inicial ou acessar seus projetos no dashboard.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#b7f34a] px-5 py-3 text-sm font-black text-[#07100a] shadow-lg shadow-[#b7f34a]/10 transition hover:brightness-105">
                  <Home size={17} />
                  Voltar ao início
                </Link>
                <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#304238] bg-[#070b09] px-5 py-3 text-sm font-black text-[#dce8e2] transition hover:border-[#b7f34a]/60 hover:text-[#b7f34a]">
                  <FolderOpen size={17} />
                  {isAuthenticated ? "Abrir meus projetos" : "Acessar dashboard"}
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#304238] bg-[#070b09] p-5 md:w-80">
              <div className="flex items-center justify-between border-b border-[#223028] pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#b7f34a] text-[#07100a]">
                    <Box size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-black">Mapa CAD</div>
                    <div className="text-[11px] uppercase tracking-[.16em] text-[#7d8e85]">rota indisponível</div>
                  </div>
                </div>
                <span className="text-xs font-black text-[#b7f34a]">404</span>
              </div>

              <div className="relative mt-5 h-56 overflow-hidden rounded-3xl border border-[#223028] bg-[#0a0f0d]">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(183,243,74,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(183,243,74,.08)_1px,transparent_1px)] bg-[size:24px_24px]" />
                <div className="absolute left-8 top-10 h-28 w-40 border-2 border-[#b7f34a]/70" />
                <div className="absolute left-24 top-10 h-28 border-l-2 border-dashed border-[#b7f34a]/50" />
                <div className="absolute left-8 top-24 w-40 border-t-2 border-dashed border-[#b7f34a]/50" />
                <div className="absolute bottom-8 right-8 flex items-center gap-2 rounded-full border border-[#ff6961]/40 bg-[#ff6961]/10 px-3 py-2 text-xs font-black text-[#ffb4ae]">
                  <ArrowLeft size={14} />
                  Sem destino
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

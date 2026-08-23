"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";

function safeErrorName(error: Error & { digest?: string }) {
  return error.name?.slice(0, 80) || "Error";
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[vetorcad][error-boundary]", {
      name: safeErrorName(error),
      digest: error.digest || null,
    });
  }, [error]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#070b09] px-5 py-8 text-[#edf5f0]">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#b7f34a]/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(183,243,74,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(183,243,74,.045)_1px,transparent_1px)] bg-[size:52px_52px]" />
      </div>

      <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-[#304238] bg-[#101613]/95 p-7 text-center shadow-2xl shadow-black/40 backdrop-blur md:p-10">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#b7f34a] text-[#07100a] shadow-lg shadow-[#b7f34a]/15">
            <AlertTriangle size={28} />
          </div>

          <div className="mt-8 inline-flex rounded-full border border-[#b7f34a]/40 bg-[#b7f34a]/10 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">
            Falha inesperada
          </div>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-black leading-tight tracking-[-.05em] md:text-6xl">
            Algo saiu fora do eixo.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[#aebeb6] md:text-lg">
            Não foi possível concluir esta ação agora. O erro foi registrado de forma segura, sem dados do seu projeto, imagens ou credenciais.
          </p>

          <div className="mx-auto mt-8 flex max-w-lg flex-col gap-3 sm:flex-row sm:justify-center">
            <button type="button" onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#b7f34a] px-5 py-3 text-sm font-black text-[#07100a] shadow-lg shadow-[#b7f34a]/10 transition hover:brightness-105">
              <RefreshCcw size={17} />
              Tentar novamente
            </button>
            <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#304238] bg-[#070b09] px-5 py-3 text-sm font-black text-[#dce8e2] transition hover:border-[#b7f34a]/60 hover:text-[#b7f34a]">
              <Home size={17} />
              Voltar ao início
            </Link>
          </div>

          <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-[#223028] bg-[#070b09] p-5 text-left">
            <div className="flex items-center justify-between border-b border-[#223028] pb-4">
              <span className="text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">Diagnóstico seguro</span>
              <span className="rounded-full border border-[#304238] px-3 py-1 text-[11px] text-[#8ea098]">sem stack trace</span>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-[#aebeb6] sm:grid-cols-3">
              <div className="rounded-2xl border border-[#1c2822] bg-[#0a0f0d] p-4">
                <div className="font-black text-[#edf5f0]">Interface</div>
                <div className="mt-2 text-xs leading-5">Pronta para recarregar o trecho afetado.</div>
              </div>
              <div className="rounded-2xl border border-[#1c2822] bg-[#0a0f0d] p-4">
                <div className="font-black text-[#edf5f0]">Privacidade</div>
                <div className="mt-2 text-xs leading-5">Nenhum conteúdo CAD é exibido no erro.</div>
              </div>
              <div className="rounded-2xl border border-[#1c2822] bg-[#0a0f0d] p-4">
                <div className="font-black text-[#edf5f0]">Continuidade</div>
                <div className="mt-2 text-xs leading-5">Você pode tentar novamente sem sair da página.</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

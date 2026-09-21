"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Globe2, Loader2, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

type LocationRow = {
  id: string;
  user_id: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  created_at: string;
};

type LocationPayload = {
  locations: LocationRow[];
  stats: {
    totalAccesses: number;
    topCountry: { country: string; accesses: number } | null;
  };
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

export function AdminLocationReport() {
  const [data, setData] = useState<LocationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadLocations = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase não configurado.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setMessage("Sessão ausente. Faça login novamente.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/admin/locations", {
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(payload?.error || "Não foi possível carregar o relatório de localização.");
      setLoading(false);
      return;
    }

    setData(payload as LocationPayload);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLocations();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLocations]);

  const rows = useMemo(() => data?.locations || [], [data?.locations]);
  const loggedUsers = useMemo(() => rows.filter((row) => row.user_id).length, [rows]);

  return <main className="min-h-screen bg-[#070b09] px-4 py-8 text-[#edf5f0] lg:px-8">
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-[#26312c] bg-[#101613] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-[#b7f34a]">
            <ArrowLeft size={14} />
            Voltar ao Admin
          </Link>
          <h1 className="mt-3 text-3xl font-black tracking-[-.04em] md:text-5xl">Relatório de localização</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#9aaaa2]">Acessos por cidade, estado e país com base nos headers nativos da Vercel, sem solicitar GPS do usuário.</p>
        </div>
        <button type="button" onClick={() => { void loadLocations(); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#34413b] px-4 py-3 text-xs font-black text-[#d6e0da] transition hover:border-[#b7f34a] hover:text-[#b7f34a]">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
          Atualizar
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-3xl border border-[#26312c] bg-[#101613] p-5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]"><MapPin size={15} /> Total de acessos</div>
          <div className="mt-4 text-4xl font-black">{data?.stats.totalAccesses ?? 0}</div>
        </section>
        <section className="rounded-3xl border border-[#26312c] bg-[#101613] p-5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]"><Globe2 size={15} /> País com mais acessos</div>
          <div className="mt-4 text-2xl font-black">{data?.stats.topCountry?.country || "Sem dados"}</div>
          {data?.stats.topCountry && <p className="mt-1 text-xs text-[#8c9a93]">{data.stats.topCountry.accesses} acesso(s)</p>}
        </section>
        <section className="rounded-3xl border border-[#26312c] bg-[#101613] p-5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]"><UsersRound size={15} /> Usuários identificados</div>
          <div className="mt-4 text-4xl font-black">{loggedUsers}</div>
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-3xl border border-[#26312c] bg-[#101613]">
        <div className="border-b border-[#26312c] p-5">
          <h2 className="text-sm font-black uppercase tracking-[.16em] text-[#b7f34a]">Últimos acessos</h2>
          {message && <p className="mt-3 rounded-xl border border-[#5a4024] bg-[#1a1309] px-3 py-2 text-xs font-bold text-[#f0c98a]">{message}</p>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#0b100e] text-[10px] uppercase tracking-[.14em] text-[#728178]">
              <tr>
                <th className="px-5 py-3">Data do acesso</th>
                <th className="px-5 py-3">Cidade</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">País</th>
                <th className="px-5 py-3">ID do usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1d2923]">
              {loading && <tr><td colSpan={5} className="px-5 py-8 text-center text-[#8c9a93]">Carregando localizações...</td></tr>}
              {!loading && rows.map((row) => <tr key={row.id} className="transition hover:bg-[#0d1411]">
                <td className="whitespace-nowrap px-5 py-4 text-[#dce8e2]">{formatDate(row.created_at)}</td>
                <td className="px-5 py-4">{row.city || "Não informado"}</td>
                <td className="px-5 py-4">{row.region || "Não informado"}</td>
                <td className="px-5 py-4">{row.country || "Não informado"}</td>
                <td className="px-5 py-4 font-mono text-xs text-[#8c9a93]">{row.user_id || "Visitante"}</td>
              </tr>)}
              {!loading && !rows.length && <tr><td colSpan={5} className="px-5 py-8 text-center text-[#8c9a93]">Nenhum acesso registrado ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </main>;
}

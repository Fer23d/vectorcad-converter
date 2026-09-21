"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileDown, FileSpreadsheet, Globe2, Loader2, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { buildLocationExportRows, getExcelColumnWidths, LOCATION_EXPORT_COLUMNS } from "@/lib/admin-location-export";

type LocationRow = {
  id: string;
  user_id: string | null;
  ip_address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
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

function hasCoordinates(row: LocationRow) {
  return typeof row.latitude === "number" && Number.isFinite(row.latitude) && typeof row.longitude === "number" && Number.isFinite(row.longitude);
}

async function exportToExcel(data: LocationRow[]) {
  const XLSX = await import("xlsx");
  const exportRows = buildLocationExportRows(data);
  const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: [...LOCATION_EXPORT_COLUMNS] });
  worksheet["!cols"] = getExcelColumnWidths(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Acessos globais");
  XLSX.writeFile(workbook, "relatorio-acessos-globais-vetorcad.xlsx");
}

async function exportToPDF(data: LocationRow[]) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const exportRows = buildLocationExportRows(data);
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date()).replace(",", "");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Relatório Analítico de Acessos Globais - VetorCAD", pageWidth / 2, 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Gerado em: ${generatedAt}`, pageWidth - 14, 28, { align: "right" });

  autoTable(doc, {
    startY: 36,
    head: [LOCATION_EXPORT_COLUMNS],
    body: exportRows.map((row) => LOCATION_EXPORT_COLUMNS.map((column) => row[column])),
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    styles: {
      fontSize: 10,
      cellPadding: 6,
    },
    columnStyles: {
      4: { halign: "center" },
      5: { halign: "center" },
    },
  });

  doc.save("relatorio-acessos-globais-vetorcad.pdf");
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
  const mappedRows = useMemo(() => rows.filter(hasCoordinates), [rows]);

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

      <section className="mt-6 overflow-hidden rounded-3xl border border-[#26312c] bg-[#08100d] shadow-[0_30px_120px_rgba(0,0,0,.45)]">
        <div className="flex flex-col gap-3 border-b border-[#26312c] bg-[#101613] p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[.16em] text-[#b7f34a]">Mapa global de usuários</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8c9a93]">
              Pontos baseados em latitude e longitude fornecidas pelos headers da Vercel. Registros sem coordenadas continuam aparecendo na tabela.
            </p>
          </div>
          <div className="rounded-2xl border border-[#2f3b35] bg-[#0b100e] px-4 py-3 text-xs font-black uppercase tracking-[.14em] text-[#dce8e2]">
            {mappedRows.length} ponto(s) no mapa
          </div>
        </div>
        <div className="relative min-h-[360px] overflow-hidden bg-[radial-gradient(circle_at_50%_10%,rgba(183,243,74,.12),transparent_35%),linear-gradient(180deg,#070b09,#0b100e)] p-4 md:p-6">
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(183,243,74,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(183,243,74,.12)_1px,transparent_1px)] [background-size:48px_48px]" />
          <ComposableMap
            projectionConfig={{ scale: 155 }}
            className="relative z-10 h-auto w-full"
            style={{ width: "100%", height: "auto" }}
          >
            <Geographies geography="/world-countries-110m.json">
              {({ geographies }) => geographies.map((geo) => <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#111a16"
                stroke="#2e3b34"
                strokeWidth={0.55}
                className="outline-none transition-colors hover:fill-[#16231d]"
              />)}
            </Geographies>
            {mappedRows.map((row) => <Marker key={row.id} coordinates={[row.longitude as number, row.latitude as number]}>
              <circle r={4.5} fill="#b7f34a" fillOpacity={0.95} stroke="#f5ffe4" strokeWidth={1.2} />
              <circle r={11} fill="#b7f34a" fillOpacity={0.12} />
              <title>{`${row.city || "Não informado"} · ${row.country || "Não informado"}`}</title>
            </Marker>)}
          </ComposableMap>
          {!loading && !mappedRows.length && <div className="absolute inset-x-4 top-1/2 z-20 mx-auto max-w-md -translate-y-1/2 rounded-2xl border border-[#34413b] bg-[#101613]/95 p-5 text-center shadow-2xl">
            <div className="text-sm font-black uppercase tracking-[.16em] text-[#b7f34a]">Sem coordenadas ainda</div>
            <p className="mt-2 text-sm text-[#9aaaa2]">Novos acessos em produção na Vercel devem preencher latitude e longitude automaticamente quando os headers estiverem disponíveis.</p>
          </div>}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-[#26312c] bg-[#101613]">
        <div className="flex flex-col gap-4 border-b border-[#26312c] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[.16em] text-[#b7f34a]">Últimos acessos</h2>
            <p className="mt-2 text-xs text-[#8c9a93]">Exporte relatórios analíticos com layout corporativo para auditoria, BI e acompanhamento comercial.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void exportToPDF(rows); }} disabled={!rows.length} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#34413b] bg-[#0b100e] px-4 py-3 text-xs font-black text-[#d6e0da] transition hover:border-[#b7f34a] hover:text-[#b7f34a] disabled:cursor-not-allowed disabled:opacity-45">
              <FileDown size={15} />
              Exportar PDF
            </button>
            <button type="button" onClick={() => { void exportToExcel(rows); }} disabled={!rows.length} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#34413b] bg-[#0b100e] px-4 py-3 text-xs font-black text-[#d6e0da] transition hover:border-[#b7f34a] hover:text-[#b7f34a] disabled:cursor-not-allowed disabled:opacity-45">
              <FileSpreadsheet size={15} />
              Exportar Excel
            </button>
          </div>
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
                <th className="px-5 py-3">IP</th>
                <th className="px-5 py-3">Coordenadas</th>
                <th className="px-5 py-3">ID do usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1d2923]">
              {loading && <tr><td colSpan={7} className="px-5 py-8 text-center text-[#8c9a93]">Carregando localizações...</td></tr>}
              {!loading && rows.map((row) => <tr key={row.id} className="transition hover:bg-[#0d1411]">
                <td className="whitespace-nowrap px-5 py-4 text-[#dce8e2]">{formatDate(row.created_at)}</td>
                <td className="px-5 py-4">{row.city || "Não informado"}</td>
                <td className="px-5 py-4">{row.region || "Não informado"}</td>
                <td className="px-5 py-4">{row.country || "Não informado"}</td>
                <td className="px-5 py-4 font-mono text-xs text-[#8c9a93]">{row.ip_address || "Não informado"}</td>
                <td className="px-5 py-4 font-mono text-xs text-[#8c9a93]">{hasCoordinates(row) ? `${row.latitude?.toFixed(4)}, ${row.longitude?.toFixed(4)}` : "Sem coordenadas"}</td>
                <td className="px-5 py-4 font-mono text-xs text-[#8c9a93]">{row.user_id || "Visitante"}</td>
              </tr>)}
              {!loading && !rows.length && <tr><td colSpan={7} className="px-5 py-8 text-center text-[#8c9a93]">Nenhum acesso registrado ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </main>;
}

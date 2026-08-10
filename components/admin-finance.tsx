"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CreditCard, DollarSign, FolderOpen, TrendingUp, UsersRound } from "lucide-react";

type PlanSummary = { plan: string; users: number; subscriptions: number; revenue: number; estimatedRevenue: number; projects: number; dailyUsage: number; daily3d: number };
type FinanceData = { metrics: { totalUsers: number; activeSubscriptions: number; mrr: number; estimatedRevenue: number; cancellations: number }; plans: PlanSummary[]; growth: { key: string; label: string; users: number }[]; availability: { subscriptions: boolean; usage: boolean; projects: boolean; paymentHistory: boolean } };
const planLabels: Record<string, string> = { free: "Free", plus: "Plus", pro: "Pro", empresarial: "Empresarial" };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function Card({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4"><div className="flex items-center justify-between text-[#b7f34a]"><span className="text-[10px] font-black uppercase tracking-[.12em] text-[#829087]">{label}</span>{icon}</div><div className="mt-3 text-2xl font-black text-[#e8efeb]">{value}</div></div>;
}

function Bar({ value, max }: { value: number; max: number }) {
  return <div className="h-2 overflow-hidden rounded-full bg-[#253229]"><div className="h-full rounded-full bg-[#b7f34a]" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} /></div>;
}

export function AdminFinance({ adminToken }: { adminToken: string }) {
  const [data, setData] = useState<FinanceData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!adminToken) return;
    fetch("/api/admin/finance", { headers: { Authorization: `Bearer ${adminToken}` } })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o financeiro.");
        setData(payload as FinanceData);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar o financeiro."));
  }, [adminToken]);
  const maxUsers = useMemo(() => Math.max(1, ...(data?.plans || []).map((item) => item.users)), [data]);
  const maxGrowth = useMemo(() => Math.max(1, ...(data?.growth || []).map((item) => item.users)), [data]);

  return <section className="mt-6 rounded-3xl border border-[#b7f34a]/30 bg-[#101613] p-5 shadow-[0_0_60px_rgba(183,243,74,.05)]"><div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><div className="flex items-center gap-2 text-[#b7f34a]"><BarChart3 size={18} /><h2 className="text-sm font-black uppercase tracking-[.14em]">Financeiro</h2></div><p className="mt-1 text-xs text-[#7c8b83]">Métricas calculadas exclusivamente a partir dos registros atuais do SaaS.</p></div><span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#829087]">Acesso restrito a ADMIN</span></div>
    {error && <div className="mt-4 rounded-xl border border-[#6a3636] bg-[#241313] p-3 text-xs text-[#ffb0b0]">{error}</div>}
    {!data && !error && <div className="mt-5 rounded-2xl border border-[#27352f] bg-[#0c110f] p-5 text-sm text-[#8c9a93]">Carregando métricas financeiras...</div>}
    {data && <><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Card label="Usuários cadastrados" value={data.metrics.totalUsers} icon={<UsersRound size={17} />} /><Card label="Assinaturas ativas" value={data.metrics.activeSubscriptions} icon={<CreditCard size={17} />} /><Card label="MRR" value={money.format(data.metrics.mrr)} icon={<DollarSign size={17} />} /><Card label="Receita estimada" value={money.format(data.metrics.estimatedRevenue)} icon={<TrendingUp size={17} />} /><Card label="Cancelamentos" value={data.metrics.cancellations} icon={<Activity size={17} />} /></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2"><section className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4"><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em]"><UsersRound size={15} className="text-[#b7f34a]" /> Contas por plano</h3><div className="mt-4 grid gap-4">{data.plans.map((item) => <div key={item.plan}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="font-bold">{planLabels[item.plan] || item.plan}</span><span className="text-[#8c9a93]">{item.users} usuários</span></div><Bar value={item.users} max={maxUsers} /></div>)}</div></section><section className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4"><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em]"><DollarSign size={15} className="text-[#b7f34a]" /> Receita por plano</h3><div className="mt-4 grid gap-3">{data.plans.filter((item) => item.subscriptions).map((item) => <div key={item.plan} className="rounded-xl border border-[#27352f] bg-[#101613] p-3"><div className="flex justify-between text-xs font-black"><span>{planLabels[item.plan] || item.plan}</span><span className="text-[#b7f34a]">{money.format(item.revenue)}</span></div><div className="mt-1 text-[10px] text-[#829087]">{item.subscriptions} assinante(s) · estimativa de tabela {money.format(item.estimatedRevenue)}</div></div>)}{!data.plans.some((item) => item.subscriptions) && <p className="text-xs text-[#829087]">Nenhuma assinatura ativa registrada.</p>}</div></section></div>
      <section className="mt-5 rounded-2xl border border-[#27352f] bg-[#0c110f] p-4"><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em]"><TrendingUp size={15} className="text-[#b7f34a]" /> Crescimento de usuários</h3><div className="mt-5 grid grid-cols-6 items-end gap-2 sm:grid-cols-12">{data.growth.map((item) => <div key={item.key} className="flex min-w-0 flex-col items-center gap-2"><div className="flex h-28 w-full items-end"><div className="w-full rounded-t bg-[#b7f34a]" style={{ height: `${item.users ? Math.max(8, (item.users / maxGrowth) * 100) : 3}%` }} title={`${item.users} novos usuários`} /></div><span className="truncate text-[9px] text-[#829087]">{item.label}</span><b className="text-[10px]">{item.users}</b></div>)}</div></section>
      <section className="mt-5 overflow-x-auto rounded-2xl border border-[#27352f] bg-[#0c110f] p-4"><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em]"><BarChart3 size={15} className="text-[#b7f34a]" /> Resumo dos planos</h3><table className="mt-4 w-full min-w-[700px] text-left text-xs"><thead className="text-[#829087]"><tr><th className="py-2">Plano</th><th>Usuários</th><th>Assinantes</th><th>Valor mensal</th><th>Receita estimada</th><th>Base</th></tr></thead><tbody>{data.plans.map((item) => <tr key={item.plan} className="border-t border-[#26312c]"><td className="py-3 font-black">{planLabels[item.plan] || item.plan}</td><td>{item.users}</td><td>{item.subscriptions}</td><td>{money.format(item.revenue)}</td><td>{money.format(item.estimatedRevenue)}</td><td>{data.metrics.totalUsers ? `${Math.round((item.users / data.metrics.totalUsers) * 100)}%` : "0%"}</td></tr>)}</tbody></table></section>
      <section className="mt-5 rounded-2xl border border-[#27352f] bg-[#0c110f] p-4"><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em]"><FolderOpen size={15} className="text-[#b7f34a]" /> Uso por plano</h3><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{data.plans.map((item) => <div key={item.plan} className="rounded-xl border border-[#27352f] bg-[#101613] p-3"><div className="font-black">{planLabels[item.plan] || item.plan}</div><div className="mt-2 text-[11px] text-[#9aa8a1]">Projetos: <b className="text-[#e8efeb]">{data.availability.projects ? item.projects : "indisponível"}</b></div><div className="mt-1 text-[11px] text-[#9aa8a1]">Uso diário registrado: <b className="text-[#e8efeb]">{data.availability.usage ? item.dailyUsage : "indisponível"}</b></div><div className="mt-1 text-[11px] text-[#9aa8a1]">Geração 3D hoje: <b className="text-[#e8efeb]">{data.availability.usage ? item.daily3d : "indisponível"}</b></div></div>)}</div><p className="mt-3 text-[10px] text-[#69776f]">O banco atual não possui histórico mensal de pagamentos nem um contador separado de OCR/IA; essas métricas não são inventadas.</p></section>
    </>}</section>;
}

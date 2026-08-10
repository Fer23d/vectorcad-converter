"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, BarChart3, CreditCard, DollarSign, FolderOpen, TrendingUp, UsersRound } from "lucide-react";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";

export type PlanSummary = { plan: string; users: number; subscriptions: number; revenue: number; estimatedRevenue: number; projects: number; dailyUsage: number; daily3d: number };
export type Integrity = { authWithoutProfile: number; authWithoutPlan: number; authWithoutBillingUser: number; billingUsersWithoutAuth: number; profilesWithoutAuth: number; subscriptionsWithoutUser: number; planDivergences: number; duplicateAuthIds: number; duplicateBillingIds: number; duplicateProfileUserIds: number };
export type FinanceData = {
  metrics: { totalUsers: number; activeSubscriptions: number; mrr: number; estimatedRevenue: number; cancellations: number };
  plans: PlanSummary[];
  growth: { key: string; label: string; users: number; projects: number; subscriptions: number }[];
  revenueSeries: { key: string; label: string; users: number; revenue: number }[];
  recentUsers: { id: string; email: string; created_at: string; last_sign_in_at: string | null; plan: string; planSource?: string }[];
  recentActivity: { id: string; kind: string; label: string; detail: string; createdAt: string }[];
  funnel: { registered: number; active: number; createdProject: number; usedAi: number | null; subscribed: number };
  newRevenueGrowth: number | null;
  averageTicket: number;
  integrity: Integrity;
  availability: { subscriptions: boolean; usage: boolean; projects: boolean; paymentHistory: boolean; aiUsage: boolean; churn: boolean; planGrowth: boolean };
};

const planLabels: Record<string, string> = { free: "Free", plus: "Plus", pro: "Pro", empresarial: "Enterprise" };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function Card({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4"><div className="flex items-center justify-between text-[#b7f34a]"><span className="text-[10px] font-black uppercase tracking-[.12em] text-[#829087]">{label}</span>{icon}</div><div className="mt-3 text-2xl font-black text-[#e8efeb]">{value}</div></div>;
}

function Bar({ value, max, color = "#b7f34a" }: { value: number; max: number; color?: string }) {
  return <div className="h-2 overflow-hidden rounded-full bg-[#253229]"><div className="h-full rounded-full" style={{ width: `${max ? Math.max(value ? 3 : 0, (value / max) * 100) : 0}%`, backgroundColor: color }} /></div>;
}

function FinanceAnalytics({ data }: { data: FinanceData }) {
  const maxUsers = Math.max(1, ...data.plans.map((item) => item.users));
  const maxProjects = Math.max(1, ...data.growth.map((item) => item.projects));
  const maxSubscriptions = Math.max(1, ...data.growth.map((item) => item.subscriptions));
  const paidPlans = data.plans.filter((item) => item.subscriptions > 0);
  const series = [
    { key: "users", title: "Novos usuários", color: "#b7f34a", max: Math.max(1, ...data.growth.map((item) => item.users)) },
    { key: "projects", title: "Novos projetos", color: "#54a9ff", max: maxProjects },
    { key: "subscriptions", title: "Novas assinaturas", color: "#d69cff", max: maxSubscriptions },
  ] as const;

  return <>
    <section className="mt-5 rounded-2xl border border-[#27352f] bg-[#0c110f] p-4">
      <h3 className="text-xs font-black uppercase tracking-[.12em] text-[#b7f34a]">Distribuição da base</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-3">{data.plans.filter((item) => ["free", "pro", "empresarial"].includes(item.plan)).map((item) => { const share = data.metrics.totalUsers ? Math.round((item.users / data.metrics.totalUsers) * 100) : 0; return <div key={item.plan} className="rounded-xl border border-[#27352f] bg-[#101613] p-3"><div className="flex justify-between text-xs font-black"><span>{planLabels[item.plan] || item.plan}</span><span className="text-[#b7f34a]">{share}%</span></div><div className="mt-2"><Bar value={item.users} max={maxUsers} /></div><div className="mt-2 text-[11px] text-[#829087]">{item.users} usuários</div></div>; })}</div>
    </section>
    <section className="mt-5 rounded-2xl border border-[#27352f] bg-[#0c110f] p-4"><h3 className="text-xs font-black uppercase tracking-[.12em] text-[#b7f34a]">Crescimento da plataforma</h3><div className="mt-4 grid gap-5 lg:grid-cols-3">{series.map((item) => <div key={item.key}><div className="mb-2 text-[10px] font-black uppercase tracking-[.12em] text-[#829087]">{item.title}</div><div className="grid grid-cols-6 items-end gap-1 sm:grid-cols-12">{data.growth.map((month) => { const value = month[item.key]; return <div key={month.key} className="flex min-w-0 flex-col items-center gap-1"><div className="flex h-20 w-full items-end"><div className="w-full rounded-t" style={{ height: `${value ? Math.max(8, (value / item.max) * 100) : 3}%`, backgroundColor: item.color }} /></div><span className="truncate text-[8px] text-[#829087]">{month.label.split(" ")[0]}</span></div>; })}</div></div>)}</div></section>
    <section className="mt-5 rounded-2xl border border-[#27352f] bg-[#0c110f] p-4"><h3 className="text-xs font-black uppercase tracking-[.12em] text-[#b7f34a]">Receita e clientes pagantes</h3><div className="mt-3 grid gap-3 md:grid-cols-3">{paidPlans.map((item) => <div key={item.plan} className="rounded-xl border border-[#27352f] bg-[#101613] p-3"><div className="flex justify-between text-xs font-black"><span>{planLabels[item.plan] || item.plan}</span><span>{money.format(item.revenue)}</span></div><div className="mt-1 text-[11px] text-[#829087]">{item.subscriptions} assinante(s) · {data.metrics.mrr ? Math.round((item.revenue / data.metrics.mrr) * 100) : 0}% do MRR</div></div>)}</div><p className="mt-3 text-[10px] text-[#69776f]">Concessões empresariais não entram na receita individual.</p></section>
    <section className="mt-5 rounded-2xl border border-[#27352f] bg-[#0c110f] p-4"><h3 className="text-xs font-black uppercase tracking-[.12em] text-[#b7f34a]">Atividade recente</h3>{data.recentActivity.length ? <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{data.recentActivity.map((event) => <div key={event.id} className="rounded-xl border border-[#27352f] bg-[#101613] p-3"><div className="flex justify-between gap-3 text-xs font-black"><span>{event.label}</span><span className="text-[10px] text-[#829087]">{new Date(event.createdAt).toLocaleDateString("pt-BR")}</span></div><div className="mt-1 text-[11px] text-[#9aa8a1]">{event.detail}</div></div>)}</div> : <p className="mt-3 text-xs text-[#829087]">Nenhuma atividade registrada.</p>}<p className="mt-3 text-[10px] text-[#69776f]">Eventos exibidos somente quando existem registros nas tabelas atuais.</p></section>
  </>;
}

export function AdminFinance({ adminToken }: { adminToken: string }) {
  const [data, setData] = useState<FinanceData | null>(null);
  const [error, setError] = useState("");
  const refreshFinance = useCallback(async () => {
    if (!adminToken) return;
    const response = await fetch("/api/admin/finance", { headers: { Authorization: `Bearer ${adminToken}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar o financeiro.");
    setData(payload as FinanceData);
    setError("");
  }, [adminToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshFinance().catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar o financeiro."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshFinance]);
  useAdminRealtime(refreshFinance, Boolean(adminToken));

  return <section className="mt-6 rounded-3xl border border-[#b7f34a]/30 bg-[#101613] p-5 shadow-[0_0_60px_rgba(183,243,74,.05)]"><div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><div className="flex items-center gap-2 text-[#b7f34a]"><BarChart3 size={18} /><h2 className="text-sm font-black uppercase tracking-[.14em]">Financeiro</h2></div><p className="mt-1 text-xs text-[#7c8b83]">Métricas calculadas exclusivamente a partir dos registros atuais do SaaS.</p></div><span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#829087]">Acesso restrito a ADMIN</span></div>
    {error && <div className="mt-4 rounded-xl border border-[#6a3636] bg-[#241313] p-3 text-xs text-[#ffb0b0]">{error}</div>}
    {!data && !error && <div className="mt-5 rounded-2xl border border-[#27352f] bg-[#0c110f] p-5 text-sm text-[#8c9a93]">Carregando métricas financeiras...</div>}
    {data && <><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Card label="MRR atual" value={money.format(data.metrics.mrr)} icon={<DollarSign size={17} />} /><Card label="Receita estimada" value={money.format(data.metrics.estimatedRevenue)} icon={<TrendingUp size={17} />} /><Card label="Usuários" value={data.metrics.totalUsers} icon={<UsersRound size={17} />} /><Card label="Pagantes" value={data.metrics.activeSubscriptions} icon={<CreditCard size={17} />} /><Card label="Assinaturas ativas" value={data.metrics.activeSubscriptions} icon={<Activity size={17} />} /><Card label="Cancelamentos" value={data.metrics.cancellations} icon={<Activity size={17} />} /></div>
      <FinanceAnalytics data={data} />
      <section className="mt-5 rounded-2xl border border-[#27352f] bg-[#0c110f] p-4"><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em]"><FolderOpen size={15} className="text-[#b7f34a]" /> Uso real por plano</h3><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{data.plans.map((item) => <div key={item.plan} className="rounded-xl border border-[#27352f] bg-[#101613] p-3"><div className="font-black">{planLabels[item.plan] || item.plan}</div><div className="mt-2 text-[11px] text-[#9aa8a1]">Projetos: <b className="text-[#e8efeb]">{data.availability.projects ? item.projects : "indisponível"}</b></div><div className="mt-1 text-[11px] text-[#9aa8a1]">Processamentos registrados hoje: <b className="text-[#e8efeb]">{data.availability.usage ? item.dailyUsage : "indisponível"}</b></div><div className="mt-1 text-[11px] text-[#9aa8a1]">Geração 3D hoje: <b className="text-[#e8efeb]">{data.availability.usage ? item.daily3d : "indisponível"}</b></div></div>)}</div><p className="mt-3 text-[10px] text-[#69776f]">O banco atual não possui contadores separados para OCR/IA, exportações ou histórico de pagamentos; essas métricas permanecem indisponíveis.</p></section>
      <section className="mt-5 overflow-x-auto rounded-2xl border border-[#27352f] bg-[#0c110f] p-4"><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em]"><UsersRound size={15} className="text-[#b7f34a]" /> Usuários recentes</h3><table className="mt-4 w-full min-w-[620px] text-left text-xs"><thead className="text-[#829087]"><tr><th className="py-2">E-mail</th><th>Plano</th><th>Cadastro</th><th>Último acesso</th></tr></thead><tbody>{data.recentUsers.map((user) => <tr key={user.id} className="border-t border-[#26312c]"><td className="py-3 font-bold">{user.email}</td><td>{planLabels[user.plan] || user.plan}</td><td>{new Date(user.created_at).toLocaleDateString("pt-BR")}</td><td>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString("pt-BR") : "Nunca"}</td></tr>)}</tbody></table></section>
      <section className="mt-5 rounded-2xl border border-[#27352f] bg-[#0c110f] p-4"><h3 className="text-xs font-black uppercase tracking-[.12em] text-[#b7f34a]">Integridade dos dados</h3><div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4"><div>Sem perfil: <b>{data.integrity.authWithoutProfile}</b></div><div>Sem plano: <b>{data.integrity.authWithoutPlan}</b></div><div>Assinaturas sem usuário: <b>{data.integrity.subscriptionsWithoutUser}</b></div><div>Divergências de plano: <b>{data.integrity.planDivergences}</b></div><div>Usuários sem billing: <b>{data.integrity.authWithoutBillingUser}</b></div><div>Billing sem auth: <b>{data.integrity.billingUsersWithoutAuth}</b></div></div></section>
    </>}</section>;
}

"use client";

import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, CreditCard, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import type { BillingPlan } from "@/lib/billing";

export type UserSubscription = {
  id: string;
  plan: string;
  status: string;
  amount: number | null;
  currency: string | null;
  payment_provider: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
};

type SubscriptionCardProps = {
  plan: BillingPlan;
  subscription: UserSubscription | null;
  usage: number;
  usageLimit: number | null;
  export3d: number;
  export3dLimit: number | null;
  companyAccess: boolean;
  cancelling: boolean;
  onCancel: () => void;
};

function statusLabel(status: string | null | undefined) {
  const value = String(status || "none").toLowerCase();
  if (["authorized", "approved", "active"].includes(value)) return { label: "Ativa", tone: "text-[#b7f34a]", icon: <CheckCircle2 size={15} /> };
  if (["cancelled", "canceled", "rejected", "paused"].includes(value)) return { label: "Cancelada", tone: "text-[#ff9b9b]", icon: <AlertTriangle size={15} /> };
  return { label: "Em processamento", tone: "text-[#e7c86a]", icon: <CalendarDays size={15} /> };
}

function usagePercent(value: number, limit: number | null) {
  if (limit === null) return 100;
  return Math.min(100, Math.round((value / Math.max(1, limit)) * 100));
}

export function SubscriptionCard({ plan, subscription, usage, usageLimit, export3d, export3dLimit, companyAccess, cancelling, onCancel }: SubscriptionCardProps) {
  const status = statusLabel(subscription?.status);
  const canCancel = Boolean(subscription?.external_id && ["authorized", "approved", "active", "pending"].includes(String(subscription?.status || "").toLowerCase()));
  const usageValue = usagePercent(usage, usageLimit);
  const exportValue = usagePercent(export3d, export3dLimit);

  return <section className="rounded-3xl border border-[#26312c] bg-[#101613] p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]"><CreditCard size={15} /> Minha assinatura</div>
        <h3 className="mt-3 text-2xl font-black tracking-[-.04em]">Plano {plan.title}</h3>
        <p className="mt-1 text-sm text-[#8c9a93]">{companyAccess ? "Acesso concedido pela empresa vinculada." : "Controle seu plano e o consumo da sua conta."}</p>
      </div>
      <div className={`inline-flex items-center gap-2 self-start rounded-full border border-[#34413b] px-3 py-2 text-xs font-black ${status.tone}`}>{status.icon} {companyAccess ? "Acesso empresarial" : status.label}</div>
    </div>

    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-[#26312c] bg-[#0b100e] p-4"><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#728178]">Mensalidade</div><div className="mt-2 text-lg font-black">{companyAccess ? "Incluída" : plan.priceLabel}</div></div>
      <div className="rounded-2xl border border-[#26312c] bg-[#0b100e] p-4"><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#728178]">Próxima cobrança</div><div className="mt-2 text-sm font-black">{companyAccess ? "Não aplicável" : subscription?.status === "active" || subscription?.status === "approved" || subscription?.status === "authorized" ? "Conforme Mercado Pago" : "Ainda não definida"}</div></div>
      <div className="rounded-2xl border border-[#26312c] bg-[#0b100e] p-4"><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#728178]">Pagamento</div><div className="mt-2 text-sm font-black">{companyAccess ? "Empresa" : subscription?.payment_provider === "mercadopago" ? "Mercado Pago" : "Não informado"}</div></div>
    </div>

    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-[#26312c] bg-[#0b100e] p-4">
        <div className="flex items-center justify-between text-xs"><span className="font-black">Uso diário</span><span className="text-[#8c9a93]">{usageLimit === null ? `${usage} · ilimitado` : `${usage}/${usageLimit}`}</span></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#1c2921]"><div className="h-full rounded-full bg-[#b7f34a] transition-all" style={{ width: `${usageValue}%` }} /></div>
      </div>
      <div className="rounded-2xl border border-[#26312c] bg-[#0b100e] p-4">
        <div className="flex items-center justify-between text-xs"><span className="font-black">Exportações 3D</span><span className="text-[#8c9a93]">{export3dLimit === null ? `${export3d} · ilimitado` : `${export3d}/${export3dLimit}`}</span></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#1c2921]"><div className="h-full rounded-full bg-[#54a9ff] transition-all" style={{ width: `${exportValue}%` }} /></div>
      </div>
    </div>

    <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Link href="/pricing" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#b7f34a] px-4 py-3 text-xs font-black text-[#09120d] transition hover:brightness-105"><ExternalLink size={14} /> Alterar plano</Link>
      <Link href="/pricing?manage=1" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#34413b] px-4 py-3 text-xs font-black text-[#d6e0da] transition hover:border-[#b7f34a] hover:text-[#b7f34a]"><ShieldCheck size={14} /> Gerenciar assinatura</Link>
      {!companyAccess && canCancel && <button type="button" onClick={onCancel} disabled={cancelling} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#633838] px-4 py-3 text-xs font-black text-[#ffabab] transition hover:bg-[#2a1111] disabled:cursor-wait disabled:opacity-60">{cancelling ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />} {cancelling ? "Cancelando..." : "Cancelar assinatura"}</button>}
    </div>
    {companyAccess && <p className="mt-4 text-xs leading-5 text-[#8c9a93]">Este acesso é administrado pela sua empresa. Para alterar ou remover o vínculo, fale com o administrador da organização.</p>}
  </section>;
}

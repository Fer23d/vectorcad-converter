"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Crown, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

type PaymentState = "idle" | "loading" | "error";

export function PricingPage() {
  const [state, setState] = useState<PaymentState>("idle");
  const [message, setMessage] = useState("Escolha o plano ideal para o seu fluxo CAD.");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  const subscribePro = async () => {
    if (!supabase) return;
    setState("loading");
    setMessage("Criando checkout seguro no Mercado Pago...");

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setState("error");
      setMessage("Faça login antes de assinar o PRO.");
      return;
    }

    const response = await fetch("/api/payment/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan: "pro" }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.init_point) {
      setState("error");
      setMessage(payload.error || "Não foi possível abrir o checkout.");
      return;
    }

    window.location.href = payload.init_point;
  };

  return <main className="min-h-screen bg-[radial-gradient(circle_at_50%_-20%,#1d3428_0,#080c0b_42%)] px-5 py-10 text-[#e8efeb]">
    <section className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[.22em] text-[#b7f34a]">VectorCAD Billing</div>
          <h1 className="mt-3 text-4xl font-black tracking-[-.05em] md:text-5xl">Planos para converter sem limite</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#9caaa3]">{message}</p>
        </div>
        <Link href={signedIn ? "/dashboard" : "/login"} className="rounded-xl border border-[#34413b] px-4 py-3 text-xs font-black text-[#d6e0da] transition hover:border-[#b7f34a] hover:text-[#b7f34a]">{signedIn ? "Voltar ao app" : "Entrar"}</Link>
      </header>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <PlanCard title="FREE" price="R$0" icon={<ShieldCheck size={20} />} features={["Projetos básicos", "Preview SVG", "Exportação limitada", "Anúncios ativos"]} />
        <PlanCard
          title="PRO"
          price="R$29/mês"
          highlighted
          icon={<Crown size={20} />}
          features={["Sem anúncios", "Exportação DXF liberada", "Recursos premium", "Pagamentos mensais via Mercado Pago"]}
          action={<button disabled={state === "loading" || !isSupabaseConfigured} onClick={subscribePro} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#b7f34a] px-4 py-3 text-sm font-black text-[#09120d] transition hover:brightness-105 disabled:opacity-60">{state === "loading" ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} Assinar Plano PRO</button>}
        />
        <PlanCard title="ENTERPRISE" price="Sob consulta" icon={<Sparkles size={20} />} features={["Plano por empresa", "SM&A enterprise", "Prioridade", "Gestão B2B no admin"]} />
      </div>
    </section>
  </main>;
}

function PlanCard({ title, price, features, icon, highlighted, action }: { title: string; price: string; features: string[]; icon: React.ReactNode; highlighted?: boolean; action?: React.ReactNode }) {
  return <article className={`rounded-3xl border p-6 ${highlighted ? "border-[#b7f34a] bg-[#142016]" : "border-[#26312c] bg-[#101613]"}`}>
    <div className="flex items-center justify-between">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#b7f34a] text-[#09120d]">{icon}</div>
      {highlighted && <span className="rounded-full bg-[#b7f34a] px-3 py-1 text-[10px] font-black uppercase text-[#09120d]">Mais usado</span>}
    </div>
    <h2 className="mt-5 text-xl font-black">{title}</h2>
    <div className="mt-2 text-3xl font-black tracking-[-.04em]">{price}</div>
    <ul className="mt-5 grid gap-3 text-sm text-[#aab8b1]">
      {features.map((feature) => <li key={feature} className="flex items-center gap-2"><Check size={15} className="text-[#b7f34a]" /> {feature}</li>)}
    </ul>
    {action}
  </article>;
}

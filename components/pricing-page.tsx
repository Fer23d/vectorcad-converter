"use client";

import Link from "next/link";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Building2, Check, Crown, Loader2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { getBillingPlan, type BillablePlan } from "@/lib/billing";
import { normalizeCompanyPlan, type CompanyPlan } from "@/lib/access-control";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

type PaymentState = "idle" | "loading" | "error";

const planOrder: CompanyPlan[] = ["free", "plus", "pro", "empresarial"];

const planIcons: Record<string, React.ReactNode> = {
  free: <ShieldCheck size={20} />,
  plus: <Zap size={20} />,
  pro: <Crown size={20} />,
  empresarial: <Building2 size={20} />,
};

type HighlightBox = {
  width: number;
  height: number;
  x: number;
  y: number;
  visible: boolean;
};

export function PricingPage() {
  const [state, setState] = useState<PaymentState>("idle");
  const [loadingPlan, setLoadingPlan] = useState<BillablePlan | null>(null);
  const [message, setMessage] = useState("Escolha o plano ideal para o seu fluxo CAD.");
  const [signedIn, setSignedIn] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<CompanyPlan>("free");
  const [activePlan, setActivePlan] = useState<CompanyPlan>("pro");
  const [highlightBox, setHighlightBox] = useState<HighlightBox>({ width: 0, height: 0, x: 0, y: 0, visible: false });
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    client.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      setSignedIn(Boolean(session));
      if (!session) return;

      const fallbackPlan = normalizeCompanyPlan(String(session.user.user_metadata?.plan || "free"));
      const { data: profile } = await client
        .from("profiles")
        .select("plan,is_premium")
        .eq("user_id", session.user.id)
        .maybeSingle();

      setCurrentPlan(profile?.is_premium ? "pro" : normalizeCompanyPlan(profile?.plan || fallbackPlan));
    });
  }, []);

  const subscribePlan = async (plan: BillablePlan) => {
    const client = supabase;
    if (!client) return;
    setState("loading");
    setLoadingPlan(plan);
    setMessage("Criando checkout seguro no Mercado Pago...");

    const { data } = await client.auth.getSession();
    if (!data.session) {
      setState("error");
      setLoadingPlan(null);
      setMessage("Faça login antes de assinar.");
      return;
    }

    try {
      const response = await fetch("/api/payment/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.init_point) {
        setState("error");
        setMessage(payload.error || "Não foi possível abrir o checkout.");
        return;
      }

      window.location.href = payload.init_point;
    } finally {
      setLoadingPlan(null);
    }
  };

  const moveHighlight = useCallback((plan: CompanyPlan) => {
    const grid = gridRef.current;
    const card = cardRefs.current[plan];
    if (!grid || !card) return;

    const gridRect = grid.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    setHighlightBox({
      width: cardRect.width,
      height: cardRect.height,
      x: cardRect.left - gridRect.left,
      y: cardRect.top - gridRect.top,
      visible: true,
    });
  }, []);

  useEffect(() => {
    moveHighlight(activePlan);
    const onResize = () => moveHighlight(activePlan);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activePlan, moveHighlight]);

  return <main className="min-h-screen bg-[radial-gradient(circle_at_50%_-20%,#1d3428_0,#080c0b_42%)] px-5 py-10 text-[#e8efeb]">
    <section className="mx-auto max-w-7xl">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[.22em] text-[#b7f34a]">VectorCAD Billing</div>
          <h1 className="mt-3 text-4xl font-black tracking-[-.05em] md:text-5xl">Planos para converter sem travar</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#9caaa3]">{message}</p>
        </div>
        <Link href={signedIn ? "/dashboard" : "/login"} className="rounded-xl border border-[#34413b] px-4 py-3 text-xs font-black text-[#d6e0da] transition hover:border-[#b7f34a] hover:text-[#b7f34a]">{signedIn ? "Voltar ao app" : "Entrar"}</Link>
      </header>

      <div ref={gridRef} className="pricing-grid relative mt-10 grid gap-4 lg:grid-cols-4">
        <div
          aria-hidden="true"
          className={`pricing-moving-highlight ${highlightBox.visible ? "opacity-100" : "opacity-0"}`}
          style={{
            width: highlightBox.width,
            height: highlightBox.height,
            transform: `translate3d(${highlightBox.x}px, ${highlightBox.y}px, 0)`,
          }}
        />
        {planOrder.map((planId) => {
          const plan = getBillingPlan(planId);
          const highlighted = plan.id === "pro";
          const current = normalizeCompanyPlan(currentPlan) === plan.id;
          const billable = plan.id !== "free";
          const checkoutPlan = plan.id as BillablePlan;
          const active = activePlan === plan.id;

          return <PlanCard
            key={plan.id}
            ref={(element) => { cardRefs.current[plan.id] = element; }}
            title={plan.title}
            price={plan.priceLabel}
            icon={planIcons[plan.id]}
            features={plan.features}
            highlighted={highlighted}
            current={current}
            active={active}
            onHover={() => setActivePlan(plan.id)}
            action={billable ? <button
              disabled={state === "loading" || !isSupabaseConfigured}
              onClick={() => subscribePlan(checkoutPlan)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#b7f34a] px-4 py-3 text-sm font-black text-[#09120d] transition hover:brightness-105 disabled:opacity-60"
            >
              {loadingPlan === checkoutPlan ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              {plan.id === "empresarial" ? "Plano Empresarial" : `Assinar ${plan.title}`}
            </button> : <Link href={signedIn ? "/dashboard" : "/signup"} className="mt-6 flex w-full items-center justify-center rounded-xl border border-[#34413b] px-4 py-3 text-sm font-black text-[#d6e0da] transition hover:border-[#b7f34a] hover:text-[#b7f34a]">Comecar gratis</Link>}
          />;
        })}
      </div>
    </section>
  </main>;
}

type PlanCardProps = {
  title: string;
  price: string;
  features: string[];
  icon: React.ReactNode;
  highlighted?: boolean;
  current?: boolean;
  active?: boolean;
  action?: React.ReactNode;
  onHover?: () => void;
};

const PlanCard = forwardRef<HTMLDivElement, PlanCardProps>(function PlanCard({ title, price, features, icon, highlighted, current, active, action, onHover }, ref) {
  return <article
    ref={ref}
    onMouseEnter={onHover}
    onFocus={onHover}
    className={`pricing-card group relative rounded-3xl border p-6 ${highlighted ? "pricing-card-pro border-[#b7f34a] bg-[#142016]" : "border-[#26312c] bg-[#101613]"} ${active ? "pricing-card-active" : ""}`}
  >
    <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_50%_0%,rgba(183,243,74,.14),transparent_45%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    <div className="flex items-center justify-between">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#b7f34a] text-[#09120d]">{icon}</div>
      <div className="flex flex-col items-end gap-2">
        {highlighted && <span className="pricing-pro-badge rounded-full bg-[#b7f34a] px-3 py-1 text-[10px] font-black uppercase text-[#09120d]">Mais usado</span>}
        {current && <span className="rounded-full border border-[#b7f34a]/50 px-3 py-1 text-[10px] font-black uppercase text-[#b7f34a]">Plano atual</span>}
      </div>
    </div>
    <h2 className="mt-5 text-xl font-black">{title}</h2>
    <div className="mt-2 text-3xl font-black tracking-[-.04em]">{price}</div>
    <ul className="mt-5 grid gap-3 text-sm text-[#aab8b1]">
      {features.map((feature) => <li key={feature} className="flex items-center gap-2"><Check size={15} className="text-[#b7f34a]" /> {feature}</li>)}
    </ul>
    {action}
  </article>;
});

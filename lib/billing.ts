import { daily3dLimitForPlan, dailyUsageLimitForPlan, normalizeCompanyPlan, planAllowsDxf, planAllowsUnlimited3d, planRemovesAds, type CompanyPlan } from "@/lib/access-control";

export type BillablePlan = "plus" | "pro" | "empresarial";

export type BillingPlan = {
  id: CompanyPlan;
  title: string;
  checkoutTitle: string;
  price: number;
  priceLabel: string;
  currency: "BRL";
  frequency: 1;
  frequencyType: "months";
  usageLimit: number | null;
  export3dLimit: number | null;
  removesAds: boolean;
  allowsDxf: boolean;
  allowsUnlimited3d: boolean;
  isPremium: boolean;
  features: string[];
};

export const BILLING_PLANS: Record<CompanyPlan, BillingPlan> = {
  free: {
    id: "free",
    title: "FREE",
    checkoutTitle: "VectorCAD FREE",
    price: 0,
    priceLabel: "R$0",
    currency: "BRL",
    frequency: 1,
    frequencyType: "months",
    usageLimit: dailyUsageLimitForPlan("free"),
    export3dLimit: daily3dLimitForPlan("free"),
    removesAds: false,
    allowsDxf: false,
    allowsUnlimited3d: false,
    isPremium: false,
    features: ["3 usos por dia", "Anúncios ativos", "SVG básico", "Sem exportação 3D"],
  },
  plus: {
    id: "plus",
    title: "PLUS",
    checkoutTitle: "VectorCAD PLUS",
    price: 19.9,
    priceLabel: "R$19,90/mes",
    currency: "BRL",
    frequency: 1,
    frequencyType: "months",
    usageLimit: dailyUsageLimitForPlan("plus"),
    export3dLimit: daily3dLimitForPlan("plus"),
    removesAds: true,
    allowsDxf: false,
    allowsUnlimited3d: false,
    isPremium: false,
    features: ["15 usos por dia", "1 exportação 3D por dia", "Sem anúncios", "Ideal para uso leve"],
  },
  pro: {
    id: "pro",
    title: "PRO",
    checkoutTitle: "VectorCAD PRO",
    price: 25.9,
    priceLabel: "R$25,90/mes",
    currency: "BRL",
    frequency: 1,
    frequencyType: "months",
    usageLimit: dailyUsageLimitForPlan("pro"),
    export3dLimit: daily3dLimitForPlan("pro"),
    removesAds: true,
    allowsDxf: true,
    allowsUnlimited3d: true,
    isPremium: true,
    features: ["Uso ilimitado", "3D ilimitado", "DXF completo", "Sem anúncios"],
  },
  empresarial: {
    id: "empresarial",
    title: "EMPRESARIAL",
    checkoutTitle: "VectorCAD EMPRESARIAL",
    price: 300,
    priceLabel: "R$300/mes",
    currency: "BRL",
    frequency: 1,
    frequencyType: "months",
    usageLimit: dailyUsageLimitForPlan("empresarial"),
    export3dLimit: daily3dLimitForPlan("empresarial"),
    removesAds: true,
    allowsDxf: true,
    allowsUnlimited3d: true,
    isPremium: true,
    features: ["Multiusuário por empresa", "Todos com acesso PRO", "Gestão centralizada", "Sem anúncios"],
  },
  enterprise: {
    id: "empresarial",
    title: "EMPRESARIAL",
    checkoutTitle: "VectorCAD EMPRESARIAL",
    price: 300,
    priceLabel: "R$300/mes",
    currency: "BRL",
    frequency: 1,
    frequencyType: "months",
    usageLimit: dailyUsageLimitForPlan("empresarial"),
    export3dLimit: daily3dLimitForPlan("empresarial"),
    removesAds: true,
    allowsDxf: true,
    allowsUnlimited3d: true,
    isPremium: true,
    features: ["Multiusuário por empresa", "Todos com acesso PRO", "Gestão centralizada", "Sem anúncios"],
  },
};

export const CHECKOUT_PLANS: BillablePlan[] = ["plus", "pro", "empresarial"];

export function getBillingPlan(plan?: string | null) {
  return BILLING_PLANS[normalizeCompanyPlan(plan)];
}

export function isBillablePlan(plan?: string | null): plan is BillablePlan {
  const normalized = normalizeCompanyPlan(plan);
  return CHECKOUT_PLANS.includes(normalized as BillablePlan);
}

export function getPlanCapabilities(plan?: string | null) {
  const normalized = normalizeCompanyPlan(plan);
  return {
    plan: normalized,
    usageLimit: dailyUsageLimitForPlan(normalized),
    export3dLimit: daily3dLimitForPlan(normalized),
    removesAds: planRemovesAds(normalized),
    allowsDxf: planAllowsDxf(normalized),
    allowsUnlimited3d: planAllowsUnlimited3d(normalized),
  };
}

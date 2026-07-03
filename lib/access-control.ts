export const PREMIUM_COMPANIES = ["SM&A"];
export const COMPANY_PLANS = ["free", "plus", "pro", "empresarial", "enterprise"] as const;

export type CompanyPlan = typeof COMPANY_PLANS[number];

export type UserAccessProfile = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  plan?: CompanyPlan | null;
  is_premium?: boolean | null;
  payment_status?: string | null;
  usage_count_today?: number | null;
  export3d_count_today?: number | null;
  last_usage_reset?: string | null;
};

export function normalizeCompany(company?: string | null) {
  const value = company?.trim();
  return value ? value : null;
}

export function isPremiumCompany(company?: string | null) {
  const normalized = normalizeCompany(company);
  return Boolean(normalized && PREMIUM_COMPANIES.some((premium) => premium.toLowerCase() === normalized.toLowerCase()));
}

export function normalizeCompanyPlan(plan?: string | null): CompanyPlan {
  if (plan === "enterprise") return "empresarial";
  return COMPANY_PLANS.includes(plan as CompanyPlan) ? plan as CompanyPlan : "free";
}

export function planHasPremiumAccess(plan?: string | null) {
  const normalized = normalizeCompanyPlan(plan);
  return normalized === "pro" || normalized === "empresarial";
}

export function planRemovesAds(plan?: string | null) {
  const normalized = normalizeCompanyPlan(plan);
  return normalized === "plus" || normalized === "pro" || normalized === "empresarial";
}

export function planAllowsDxf(plan?: string | null) {
  const normalized = normalizeCompanyPlan(plan);
  return normalized === "pro" || normalized === "empresarial";
}

export function planAllowsUnlimited3d(plan?: string | null) {
  const normalized = normalizeCompanyPlan(plan);
  return normalized === "pro" || normalized === "empresarial";
}

export function dailyUsageLimitForPlan(plan?: string | null) {
  const normalized = normalizeCompanyPlan(plan);
  if (normalized === "free") return 3;
  if (normalized === "plus") return 15;
  return null;
}

export function daily3dLimitForPlan(plan?: string | null) {
  const normalized = normalizeCompanyPlan(plan);
  if (normalized === "free") return 0;
  if (normalized === "plus") return 1;
  return null;
}

export function shouldHideAdsForPlan(plan?: string | null) {
  return planRemovesAds(plan);
}

export function userHasPremiumAccess(profile?: Pick<UserAccessProfile, "company" | "plan" | "is_premium"> | null) {
  return Boolean(profile?.is_premium || isPremiumCompany(profile?.company) || planHasPremiumAccess(profile?.plan));
}

export function shouldShowAds(profile?: Pick<UserAccessProfile, "company" | "plan" | "is_premium"> | null) {
  return !(profile?.is_premium || isPremiumCompany(profile?.company) || planRemovesAds(profile?.plan));
}

export function resolveEffectivePlan(profile?: Pick<UserAccessProfile, "company" | "plan" | "is_premium"> | null): CompanyPlan {
  if (profile?.is_premium || isPremiumCompany(profile?.company) || normalizeCompanyPlan(profile?.plan) === "empresarial") return "empresarial";
  return normalizeCompanyPlan(profile?.plan);
}

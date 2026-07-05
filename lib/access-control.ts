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

export function resolveUserPlan(user?: { plan?: string | null; is_premium?: boolean | null; company?: string | null } | null): CompanyPlan {
  // Company text is informational for normal profiles. Premium access must come
  // from billing/admin controlled fields, not from a user-editable company name.
  const userPlan = normalizeCompanyPlan(user?.plan);
  if (userPlan === "empresarial") return "empresarial";
  if (userPlan === "pro") return "pro";
  if (user?.is_premium) return "pro";
  if (userPlan === "plus") return "plus";

  return "free";
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

export function canUseFeature(profile?: Pick<UserAccessProfile, "company" | "plan" | "is_premium" | "usage_count_today"> | null) {
  const plan = resolveUserPlan(profile);
  const limit = dailyUsageLimitForPlan(plan);
  if (limit === null) return true;
  return Number(profile?.usage_count_today || 0) < limit;
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
  return planHasPremiumAccess(resolveUserPlan(profile));
}

export function shouldShowAds(profile?: Pick<UserAccessProfile, "company" | "plan" | "is_premium"> | null) {
  return !planRemovesAds(resolveUserPlan(profile));
}

export function resolveEffectivePlan(profile?: Pick<UserAccessProfile, "company" | "plan" | "is_premium"> | null): CompanyPlan {
  return resolveUserPlan(profile);
}

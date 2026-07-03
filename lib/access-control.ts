export const PREMIUM_COMPANIES = ["SM&A"];
export const COMPANY_PLANS = ["free", "pro", "enterprise"] as const;

export type CompanyPlan = typeof COMPANY_PLANS[number];

export type UserAccessProfile = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
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
  return COMPANY_PLANS.includes(plan as CompanyPlan) ? plan as CompanyPlan : "free";
}

export function planHasPremiumAccess(plan?: string | null) {
  const normalized = normalizeCompanyPlan(plan);
  return normalized === "pro" || normalized === "enterprise";
}

export function shouldHideAdsForPlan(plan?: string | null) {
  return planHasPremiumAccess(plan);
}

export function userHasPremiumAccess(profile?: Pick<UserAccessProfile, "company"> | null) {
  return isPremiumCompany(profile?.company);
}

export function shouldShowAds(profile?: Pick<UserAccessProfile, "company"> | null) {
  return !userHasPremiumAccess(profile);
}

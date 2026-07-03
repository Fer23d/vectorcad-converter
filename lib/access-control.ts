export const PREMIUM_COMPANIES = ["SM&A"];

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

export function userHasPremiumAccess(profile?: Pick<UserAccessProfile, "company"> | null) {
  return isPremiumCompany(profile?.company);
}

export function shouldShowAds(profile?: Pick<UserAccessProfile, "company"> | null) {
  return !userHasPremiumAccess(profile);
}

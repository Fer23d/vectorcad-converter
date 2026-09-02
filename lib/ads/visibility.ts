import { planRemovesAds, shouldShowAds, type UserAccessProfile } from "@/lib/access-control";
import {
  getAdsConfig,
  prohibitedAdRoutePrefixes,
  resolveAdsEnvironment,
  type AdConsent,
  type AdPlacement,
  type AdProvider,
  type AdsConfig,
  type AdsEnvironment,
} from "@/lib/ads/config";

type AdProfile = Pick<UserAccessProfile, "company" | "companyPlan" | "plan" | "is_premium"> & {
  role?: string | null;
};

type AdDecisionInput = {
  profile?: AdProfile | null;
  route?: string | null;
  placement: AdPlacement;
  provider?: AdProvider;
  environment?: AdsEnvironment | string;
  consent?: AdConsent | null;
  hasSource?: boolean;
  config?: Partial<AdsConfig>;
};

export type AdDecision = {
  allowed: boolean;
  reason: string;
};

const publicPlacements: AdPlacement[] = ["public-home", "blog-list", "blog-article"];
const blogPlacements: AdPlacement[] = ["blog-list", "blog-article"];
const privatePlacements: AdPlacement[] = ["dashboard-free", "editor-upload-free"];

function normalizedRoute(route?: string | null) {
  if (!route) return "/";
  return route.startsWith("/") ? route : `/${route}`;
}

function isProhibitedRoute(route?: string | null) {
  const value = normalizedRoute(route);
  return prohibitedAdRoutePrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}/`));
}

function placementAllowed(placement: AdPlacement, config: AdsConfig) {
  if (placement === "public-home") return config.allowPublicPages;
  if (blogPlacements.includes(placement)) return config.allowPublicPages && config.allowBlog;
  if (placement === "dashboard-free") return config.allowDashboardFree;
  if (placement === "editor-upload-free") return config.allowEditorUploadFree;
  return false;
}

export function getAdDecision(input: AdDecisionInput): AdDecision {
  const provider = input.provider || "direct";
  const config = getAdsConfig(input.config);
  const environment = resolveAdsEnvironment(input.environment);
  const route = normalizedRoute(input.route);

  if (!config.enabled) return { allowed: false, reason: "ADS_DISABLED" };
  if (config.blockInDevelopment && environment !== "production") return { allowed: false, reason: "ADS_BLOCKED_IN_ENVIRONMENT" };
  if (isProhibitedRoute(route)) return { allowed: false, reason: "PROHIBITED_ROUTE" };
  if (!placementAllowed(input.placement, config)) return { allowed: false, reason: "PLACEMENT_DISABLED" };
  if (provider === "adsense" && !config.adsenseEnabled) return { allowed: false, reason: "ADSENSE_DISABLED" };
  if (provider === "direct" && !config.directAdsEnabled) return { allowed: false, reason: "DIRECT_ADS_DISABLED" };
  if (provider === "adsense" && !input.consent?.advertising) return { allowed: false, reason: "AD_CONSENT_REQUIRED" };
  if (input.profile?.role === "ADMIN") return { allowed: false, reason: "ADMIN_BLOCKED" };
  if (input.placement === "editor-upload-free" && input.hasSource) return { allowed: false, reason: "EDITOR_ACTIVE" };

  if (privatePlacements.includes(input.placement)) {
    if (!input.profile) return { allowed: false, reason: "PROFILE_LOADING" };
    return shouldShowAds(input.profile)
      ? { allowed: true, reason: "ALLOWED_FREE_PRIVATE_PLACEMENT" }
      : { allowed: false, reason: "PLAN_REMOVES_ADS" };
  }

  if (publicPlacements.includes(input.placement) && input.profile && planRemovesAds(input.profile.plan)) {
    return { allowed: false, reason: "PLAN_REMOVES_ADS" };
  }

  return { allowed: true, reason: "ALLOWED_PUBLIC_PLACEMENT" };
}

export function canRenderAd(input: AdDecisionInput) {
  return getAdDecision(input).allowed;
}

export type { AdProfile };

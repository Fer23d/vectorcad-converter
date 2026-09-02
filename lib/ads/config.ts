export type AdProvider = "direct" | "adsense";

export type AdPlacement =
  | "public-home"
  | "blog-list"
  | "blog-article"
  | "dashboard-free"
  | "editor-upload-free";

export type AdConsent = {
  advertising: boolean;
};

export type AdsEnvironment = "production" | "preview" | "development" | "test";

export type AdsConfig = {
  enabled: boolean;
  adsenseEnabled: boolean;
  directAdsEnabled: boolean;
  allowPublicPages: boolean;
  allowBlog: boolean;
  allowDashboardFree: boolean;
  allowEditorUploadFree: boolean;
  blockInDevelopment: boolean;
};

export const defaultAdsConfig: AdsConfig = {
  enabled: false,
  adsenseEnabled: false,
  directAdsEnabled: false,
  allowPublicPages: true,
  allowBlog: true,
  allowDashboardFree: false,
  allowEditorUploadFree: true,
  blockInDevelopment: true,
};

export const prohibitedAdRoutePrefixes = [
  "/admin",
  "/login",
  "/signup",
  "/reset-password",
  "/mfa",
  "/pricing",
  "/checkout",
  "/api",
  "/projetos",
];

function publicFlag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

export function resolveAdsEnvironment(environment: string | undefined = process.env.NODE_ENV): AdsEnvironment {
  if (environment === "production") return "production";
  if (environment === "test") return "test";
  if (process.env.VERCEL_ENV === "preview") return "preview";
  return "development";
}

export function getAdsConfig(overrides: Partial<AdsConfig> = {}): AdsConfig {
  return {
    ...defaultAdsConfig,
    enabled: publicFlag(process.env.NEXT_PUBLIC_ADS_ENABLED),
    adsenseEnabled: publicFlag(process.env.NEXT_PUBLIC_ADSENSE_ENABLED),
    directAdsEnabled: publicFlag(process.env.NEXT_PUBLIC_DIRECT_ADS_ENABLED),
    ...overrides,
  };
}

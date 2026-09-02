import { describe, expect, it } from "vitest";
import { canRenderAd, getAdDecision } from "@/lib/ads/visibility";
import type { AdsConfig } from "@/lib/ads/config";

const enabledDirectAdsConfig: Partial<AdsConfig> = {
  enabled: true,
  directAdsEnabled: true,
  adsenseEnabled: false,
  allowPublicPages: true,
  allowBlog: true,
  allowDashboardFree: true,
  allowEditorUploadFree: true,
  blockInDevelopment: true,
};

describe("central ad visibility rules", () => {
  it("allows direct ads for a free user on the initial editor upload state", () => {
    expect(canRenderAd({
      placement: "editor-upload-free",
      provider: "direct",
      route: "/editor",
      environment: "production",
      hasSource: false,
      profile: { company: null, companyPlan: null, plan: "free", is_premium: false },
      config: enabledDirectAdsConfig,
    })).toBe(true);
  });

  it("blocks direct ads when the editor already has a source file loaded", () => {
    expect(getAdDecision({
      placement: "editor-upload-free",
      provider: "direct",
      route: "/editor",
      environment: "production",
      hasSource: true,
      profile: { company: null, companyPlan: null, plan: "free", is_premium: false },
      config: enabledDirectAdsConfig,
    })).toMatchObject({ allowed: false, reason: "EDITOR_ACTIVE" });
  });

  it("blocks editor ads while the authenticated profile is still loading", () => {
    expect(getAdDecision({
      placement: "editor-upload-free",
      provider: "direct",
      route: "/editor",
      environment: "production",
      hasSource: false,
      profile: undefined,
      config: enabledDirectAdsConfig,
    })).toMatchObject({ allowed: false, reason: "PROFILE_LOADING" });
  });

  it("blocks direct ads for paid plans", () => {
    for (const plan of ["plus", "pro", "empresarial"] as const) {
      expect(canRenderAd({
        placement: "editor-upload-free",
        provider: "direct",
        route: "/editor",
        environment: "production",
        hasSource: false,
        profile: { company: null, companyPlan: null, plan, is_premium: plan === "pro" },
        config: enabledDirectAdsConfig,
      })).toBe(false);
    }
  });

  it("blocks ads for admins and prohibited routes", () => {
    expect(getAdDecision({
      placement: "dashboard-free",
      provider: "direct",
      route: "/dashboard",
      environment: "production",
      profile: { company: null, companyPlan: null, plan: "free", is_premium: false, role: "ADMIN" },
      config: enabledDirectAdsConfig,
    })).toMatchObject({ allowed: false, reason: "ADMIN_BLOCKED" });

    for (const route of ["/login", "/signup", "/reset-password", "/mfa/setup", "/pricing", "/admin", "/api/usage/consume"]) {
      expect(canRenderAd({
        placement: "public-home",
        provider: "direct",
        route,
        environment: "production",
        profile: null,
        config: enabledDirectAdsConfig,
      })).toBe(false);
    }
  });

  it("allows anonymous direct ads on public home only when flags and environment allow it", () => {
    expect(canRenderAd({
      placement: "public-home",
      provider: "direct",
      route: "/",
      environment: "production",
      profile: null,
      config: enabledDirectAdsConfig,
    })).toBe(true);

    expect(getAdDecision({
      placement: "public-home",
      provider: "direct",
      route: "/",
      environment: "development",
      profile: null,
      config: enabledDirectAdsConfig,
    })).toMatchObject({ allowed: false, reason: "ADS_BLOCKED_IN_ENVIRONMENT" });
  });

  it("keeps AdSense disabled without an explicit flag and advertising consent", () => {
    expect(getAdDecision({
      placement: "blog-article",
      provider: "adsense",
      route: "/blog/converter-pdf-para-dxf",
      environment: "production",
      profile: null,
      consent: { advertising: true },
      config: enabledDirectAdsConfig,
    })).toMatchObject({ allowed: false, reason: "ADSENSE_DISABLED" });

    expect(getAdDecision({
      placement: "blog-article",
      provider: "adsense",
      route: "/blog/converter-pdf-para-dxf",
      environment: "production",
      profile: null,
      consent: { advertising: false },
      config: { ...enabledDirectAdsConfig, adsenseEnabled: true },
    })).toMatchObject({ allowed: false, reason: "AD_CONSENT_REQUIRED" });
  });
});

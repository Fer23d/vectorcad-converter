"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { canRenderAd, type AdProfile } from "@/lib/ads/visibility";
import type { AdConsent, AdPlacement, AdProvider, AdsEnvironment, AdsConfig } from "@/lib/ads/config";

type AdSlotProps = {
  children: ReactNode;
  placement: AdPlacement;
  provider?: AdProvider;
  profile?: AdProfile | null;
  route?: string;
  environment?: AdsEnvironment | string;
  consent?: AdConsent | null;
  hasSource?: boolean;
  config?: Partial<AdsConfig>;
};

export function AdSlot({
  children,
  placement,
  provider = "direct",
  profile,
  route,
  environment,
  consent,
  hasSource,
  config,
}: AdSlotProps) {
  const pathname = usePathname();
  const allowed = canRenderAd({
    profile,
    route: route || pathname,
    placement,
    provider,
    environment,
    consent,
    hasSource,
    config,
  });

  if (!allowed) return null;
  return <>{children}</>;
}

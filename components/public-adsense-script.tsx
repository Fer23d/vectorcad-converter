import Script from "next/script";
import { getAdsConfig, resolveAdsEnvironment } from "@/lib/ads/config";

const ADSENSE_CLIENT = "ca-pub-5004421599745939";

export function PublicAdSenseScript() {
  const config = getAdsConfig();
  const environment = resolveAdsEnvironment();

  if (!config.enabled || !config.adsenseEnabled || (config.blockInDevelopment && environment !== "production")) {
    return null;
  }

  return (
    <Script
      id="google-adsense-public"
      async
      strategy="afterInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
      crossOrigin="anonymous"
    />
  );
}

import Script from "next/script";

const ADSENSE_CLIENT = "ca-pub-5004421599745939";

export function PublicAdSenseScript() {
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

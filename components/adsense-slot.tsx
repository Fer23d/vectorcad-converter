"use client";

import { useEffect, useRef } from "react";

const ADSENSE_CLIENT = "ca-pub-5004421599745939";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSenseSlotProps = {
  slot?: string;
  enabled: boolean;
  className?: string;
  label?: string;
  format?: "auto" | "fluid";
  layout?: string;
};

export function AdSenseSlot({ slot, enabled, className = "", label = "Publicidade", format = "auto", layout }: AdSenseSlotProps) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!enabled || !slot || initialized.current) return;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      initialized.current = true;
    } catch (error) {
      console.warn("[adsense] could not initialize slot", error);
    }
  }, [enabled, slot]);

  if (!enabled || !slot) return null;

  return <div className={`rounded-2xl border border-[#26312c] bg-[#0d1210] p-3 ${className}`}>
    <div className="mb-2 text-[9px] font-black uppercase tracking-[.16em] text-[#6f7d75]">{label}</div>
    <ins
      className="adsbygoogle block min-h-24 w-full"
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-ad-layout={layout}
      data-full-width-responsive="true"
    />
  </div>;
}


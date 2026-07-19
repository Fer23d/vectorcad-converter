"use client";

import { useEffect, useState } from "react";

export function ParallaxBackground() {
  const [scrollY, setScrollY] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const updateMotionPreference = () => setReducedMotion(motionQuery.matches);
    const updateMobilePreference = () => setIsMobile(mobileQuery.matches);
    updateMotionPreference();
    updateMobilePreference();
    motionQuery.addEventListener("change", updateMotionPreference);
    mobileQuery.addEventListener("change", updateMobilePreference);

    let frame = 0;
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        frame = 0;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      motionQuery.removeEventListener("change", updateMotionPreference);
      mobileQuery.removeEventListener("change", updateMobilePreference);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const progress = reducedMotion ? 0.18 : Math.min(1, scrollY / 720);
  const shift = reducedMotion ? 0 : Math.min(36, scrollY * (isMobile ? 0.02 : 0.055));
  const lineOffset = 980 - progress * 980;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute -left-24 top-20 h-80 w-80 rounded-full bg-[#b7f34a]/10 blur-3xl transition-transform duration-300"
        style={{ transform: `translate3d(${shift * 0.5}px, ${shift * -0.35}px, 0)` }}
      />
      <div
        className="absolute -right-36 top-32 h-[28rem] w-[28rem] rounded-full bg-[#35d6a0]/8 blur-3xl transition-transform duration-300"
        style={{ transform: `translate3d(${shift * -0.35}px, ${shift * 0.25}px, 0)` }}
      />
      <svg
        className="absolute right-[-12%] top-10 h-[28rem] w-[58rem] max-w-none opacity-35 sm:right-[-6%] lg:right-[-2%]"
        viewBox="0 0 980 520"
        fill="none"
        style={{ transform: `translate3d(0, ${shift * -0.55}px, 0)` }}
      >
        <g stroke="#b7f34a" strokeWidth="1" strokeOpacity=".32">
          <path d="M42 96h174v86h138v-54h152v112h164v-90h206" />
          <path d="M72 312h122v-68h160v108h126v-74h174v92h142" />
          <path d="M216 96v86M354 128v116M506 240v-112M670 240v-90M822 150v-54" />
          <path d="M194 312v74h160v-34h126v68h174v-76h142" />
          <circle cx="216" cy="96" r="7" /><circle cx="354" cy="244" r="7" />
          <circle cx="506" cy="128" r="7" /><circle cx="670" cy="240" r="7" />
          <rect x="116" y="116" width="46" height="46" rx="4" />
          <rect x="756" y="260" width="54" height="54" rx="4" />
        </g>
        <path
          d="M42 96h174v86h138v-54h152v112h164v-90h206M72 312h122v-68h160v108h126v-74h174v92h142"
          stroke="#b7f34a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="980"
          strokeDashoffset={lineOffset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <svg
        className="absolute bottom-[-4rem] left-[-12%] h-64 w-[42rem] max-w-none opacity-20 sm:left-[-5%]"
        viewBox="0 0 700 280"
        fill="none"
        style={{ transform: `translate3d(${shift * 0.28}px, ${shift * 0.2}px, 0)` }}
      >
        <g stroke="#35d6a0" strokeWidth="1.2">
          <path d="M20 212h140V82h110v96h132V52h138v160h140" />
          <path d="M20 236h180M318 236h202M580 236h110" />
          <circle cx="160" cy="82" r="10" /><circle cx="402" cy="52" r="10" /><rect x="520" y="116" width="42" height="42" />
        </g>
      </svg>
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#070b09] via-[#070b09]/60 to-transparent" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(183,243,74,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(183,243,74,.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
    </div>
  );
}

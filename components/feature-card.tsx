"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  index?: number;
  scrollY?: number;
};

export function FeatureCard({ icon, title, description, index = 0, scrollY = 0 }: FeatureCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = cardRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.18 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const tilt = Math.sin((scrollY + index * 140) / 480) * 1.15;
  const scale = 1 + Math.min(0.012, Math.abs(Math.cos((scrollY + index * 90) / 520)) * 0.012);

  return (
    <article
      ref={cardRef}
      className={`group rounded-3xl border border-[#26382e] bg-[#0b120f]/90 p-5 shadow-2xl shadow-black/20 transition-all duration-700 hover:-translate-y-1 hover:border-[#b7f34a]/60 hover:bg-[#101a15] ${isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
      style={{
        transitionDelay: `${index * 80}ms`,
        transform: isVisible ? `perspective(900px) rotateX(${tilt}deg) scale(${scale})` : "translateY(24px)",
      }}
    >
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#b7f34a]/30 bg-[#b7f34a]/10 text-[#b7f34a] transition group-hover:border-[#b7f34a]/70 group-hover:bg-[#b7f34a]/20">
        {icon}
      </div>
      <h3 className="mt-5 text-lg font-black tracking-[-.02em] text-[#f2f8f4]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[#aebeb6]">{description}</p>
    </article>
  );
}

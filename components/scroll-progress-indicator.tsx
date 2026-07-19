"use client";

import { useEffect, useState } from "react";

export function ScrollProgressIndicator() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(scrollableHeight > 0 ? Math.min(100, (window.scrollY / scrollableHeight) * 100) : 0);
        frame = 0;
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 md:block" aria-label={`Progresso da página: ${Math.round(progress)}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
      <div className="relative h-28 w-1 overflow-hidden rounded-full bg-[#26382e]">
        <div className="absolute inset-x-0 bottom-0 rounded-full bg-[#b7f34a] shadow-[0_0_12px_rgba(183,243,74,.85)] transition-[height] duration-150" style={{ height: `${progress}%` }} />
      </div>
      <span className="absolute -right-1 top-full mt-2 translate-x-1/2 text-[9px] font-black text-[#8ea098]">{Math.round(progress)}%</span>
    </div>
  );
}

"use client";

import { Zap } from "lucide-react";

type UsageMeterProps = {
  plan: string;
  usage: number;
  limit: number | null;
  onUpgrade?: () => void;
};

function progressTone(percent: number) {
  if (percent >= 80) return "from-[#ff7a7a] to-[#ffb199]";
  if (percent >= 50) return "from-[#ffd166] to-[#ffe08a]";
  return "from-[#b7f34a] to-[#d8ff88]";
}

export function UsageMeter({ plan, usage, limit, onUpgrade }: UsageMeterProps) {
  const unlimited = limit === null;
  const safeLimit = limit || 1;
  const percent = unlimited ? 100 : Math.min(100, Math.round((usage / safeLimit) * 100));
  const remaining = unlimited ? null : Math.max(0, safeLimit - usage);

  return <div className="rounded-3xl border border-[#26312c] bg-[#101613] p-5 shadow-xl shadow-black/20">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">
          <Zap size={14} />
          Uso diario
        </div>
        <div className="mt-3 text-2xl font-black tracking-[-.03em] text-white">
          {unlimited ? "Uso ilimitado" : `${usage} / ${safeLimit}`}
        </div>
        <p className="mt-1 text-xs text-[#8c9a93]">
          {unlimited ? `Plano ${plan.toUpperCase()} sem limite diario.` : `${usage} / ${safeLimit} usos utilizados hoje`}
        </p>
      </div>
      <span className="rounded-full border border-[#34413b] px-3 py-1 text-[10px] font-black uppercase text-[#d6e0da]">
        {plan}
      </span>
    </div>

    <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#202a25]">
      <div className={`h-full rounded-full bg-gradient-to-r ${progressTone(percent)} transition-all duration-500`} style={{ width: `${percent}%` }} />
    </div>

    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#8c9a93]">
      <span>{unlimited ? "Sem bloqueio de uso" : remaining === 0 ? "Limite atingido" : `${remaining} usos restantes hoje`}</span>
      {!unlimited && <span>{percent}%</span>}
    </div>

    {!unlimited && onUpgrade && <button type="button" onClick={onUpgrade} className="mt-4 w-full rounded-xl bg-[#b7f34a] px-4 py-3 text-xs font-black text-[#09120d] transition hover:brightness-105">
      Fazer upgrade
    </button>}
  </div>;
}

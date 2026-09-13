"use client";

import { CheckCircle2, FileText, Lock, PlayCircle, Target } from "lucide-react";
import type { AcademyStep } from "@/types/academy";

type VetorCADAcademyStepProps = {
  step: AcademyStep | null;
  completed: boolean;
  locked: boolean;
  saving: boolean;
  onComplete: (stepId: string) => void;
};

export function VetorCADAcademyStep({ step, completed, locked, saving, onComplete }: VetorCADAcademyStepProps) {
  if (!step) {
    return <section className="rounded-3xl border border-[#b7f34a]/25 bg-[#101613] p-6">
      <div className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Trilha concluída</div>
      <h3 className="mt-3 text-2xl font-black tracking-[-.04em] text-white">Sistema de evolução completo</h3>
      <p className="mt-3 text-sm leading-6 text-[#9aaba2]">Todas as etapas atuais da VetorCAD Academy foram concluídas. Novos módulos poderão ser adicionados para vídeos, artigos e certificações.</p>
    </section>;
  }

  return <section className="rounded-3xl border border-[#26312c] bg-[#101613] p-6 shadow-2xl shadow-black/20">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">
          <Target size={15} />
          Etapa {String(step.sequence).padStart(2, "0")}
        </div>
        <h3 className="mt-3 text-2xl font-black tracking-[-.04em] text-white">{step.title}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#98a9a0]">{step.description}</p>
      </div>
      <span className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[.12em] ${completed ? "border-[#b7f34a]/40 bg-[#172314] text-[#dfffc0]" : locked ? "border-[#34413b] text-[#77867e]" : "border-[#b7f34a]/35 text-[#b7f34a]"}`}>
        {completed ? <CheckCircle2 size={14} /> : locked ? <Lock size={14} /> : <PlayCircle size={14} />}
        {completed ? "Concluída" : locked ? "Bloqueada" : "Em andamento"}
      </span>
    </div>

    <div className="mt-6 grid gap-4 lg:grid-cols-[.95fr_1.05fr]">
      <div className="rounded-2xl border border-[#2b3931] bg-[#0b100e] p-4">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-[#728178]">
          {step.mediaPlaceholder.type === "video" ? <PlayCircle size={14} /> : <FileText size={14} />}
          Vídeo / imagem preparada
        </div>
        <div className="mt-4 grid aspect-video place-items-center rounded-2xl border border-dashed border-[#34413b] bg-[linear-gradient(135deg,rgba(183,243,74,.08),rgba(7,11,9,.15))] px-5 text-center">
          <div>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[#b7f34a]/30 bg-[#172314] text-[#b7f34a]">
              {step.mediaPlaceholder.type === "video" ? <PlayCircle size={22} /> : <FileText size={22} />}
            </div>
            <p className="mt-3 text-xs font-bold text-[#dbe6e0]">{step.mediaPlaceholder.label}</p>
            <p className="mt-1 text-[11px] text-[#728178]">Estrutura pronta para mídia real.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#2b3931] bg-[#0b100e] p-4">
        <div className="text-[10px] font-black uppercase tracking-[.16em] text-[#728178]">Objetivo técnico</div>
        <p className="mt-2 text-sm font-bold leading-6 text-[#e5eee8]">{step.objective}</p>
        <div className="mt-5 text-[10px] font-black uppercase tracking-[.16em] text-[#728178]">Checklist operacional</div>
        <div className="mt-3 grid gap-2">
          {step.checklist.map((item) => <div key={item} className="flex items-center gap-2 rounded-xl border border-[#26312c] bg-[#101613] px-3 py-2 text-xs text-[#a9b8b0]">
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${completed ? "border-[#b7f34a] bg-[#b7f34a] text-[#09120d]" : "border-[#405047] text-[#728178]"}`}>
              {completed ? <CheckCircle2 size={13} /> : null}
            </span>
            {item}
          </div>)}
        </div>
      </div>
    </div>

    <button
      type="button"
      disabled={completed || locked || saving}
      onClick={() => onComplete(step.id)}
      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#b7f34a] px-5 py-3 text-xs font-black text-[#09120d] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {completed ? "Etapa concluída" : saving ? "Salvando progresso..." : "Concluir etapa"}
      {!completed && !saving && <CheckCircle2 size={15} />}
    </button>
  </section>;
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Gauge, Lock, Route, ShieldCheck, TerminalSquare } from "lucide-react";
import { buildAcademyProgress, isAcademyStepUnlocked } from "@/lib/academy/progress";
import { supabase } from "@/lib/supabase/client";
import type { AcademyProgressSummary, AcademyStep } from "@/types/academy";
import { VetorCADAcademyStep } from "@/components/vetorcad-academy-step";

type AcademyApiPayload = {
  progress?: AcademyProgressSummary;
  error?: string;
};

function statusLabel(status: string) {
  if (status === "completed") return "concluído";
  if (status === "active") return "ativo";
  return "bloqueado";
}

export function VetorCADAcademy() {
  const [progress, setProgress] = useState<AcademyProgressSummary>(() => buildAcademyProgress());
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStepId, setSavingStepId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const selectedStep = useMemo(() => {
    const moduleStep = progress.modules.flatMap((module) => module.steps).find((step) => step.id === selectedStepId);
    return moduleStep || progress.currentStep;
  }, [progress, selectedStepId]);

  const completed = Boolean(selectedStep && progress.completedStepIds.includes(selectedStep.id));
  const locked = Boolean(selectedStep && !isAcademyStepUnlocked(selectedStep.id, progress.completedStepIds));

  const requestProgress = useCallback(async (method: "GET" | "POST", stepId?: string) => {
    if (!supabase) {
      setMessage("Supabase não configurado para sincronizar seu progresso.");
      return null;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setMessage("Faça login novamente para sincronizar seu progresso.");
      return null;
    }

    const response = await fetch("/api/academy/progress", {
      method,
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: method === "POST" ? JSON.stringify({ stepId }) : undefined,
    });
    const payload = await response.json().catch(() => ({})) as AcademyApiPayload;
    if (!response.ok || !payload.progress) {
      setMessage(payload.error || "Não foi possível sincronizar a VetorCAD Academy.");
      return null;
    }

    setMessage("");
    setProgress(payload.progress);
    return payload.progress;
  }, []);

  useEffect(() => {
    let mounted = true;
    const timer = window.setTimeout(() => {
      requestProgress("GET").then((nextProgress) => {
        if (!mounted) return;
        if (nextProgress?.currentStep) setSelectedStepId(nextProgress.currentStep.id);
        setLoading(false);
      });
    }, 0);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [requestProgress]);

  const completeStep = useCallback(async (stepId: string) => {
    setSavingStepId(stepId);
    const nextProgress = await requestProgress("POST", stepId);
    setSavingStepId(null);
    if (nextProgress?.currentStep) setSelectedStepId(nextProgress.currentStep.id);
  }, [requestProgress]);

  return <section className="rounded-[2rem] border border-[#26312c] bg-[#080c0b] p-5 shadow-2xl shadow-black/20 sm:p-6">
    <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <div className="rounded-3xl border border-[#26312c] bg-[#101613] p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[#b7f34a]/35 bg-[#172314] text-[#b7f34a]">
            <TerminalSquare size={22} />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">VetorCAD Academy</div>
            <h2 className="mt-1 text-2xl font-black tracking-[-.04em] text-white">Sistema de evolução profissional</h2>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[#2b3931] bg-[#0b100e] p-4">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-black uppercase tracking-[.14em] text-[#728178]">Progresso do sistema</span>
            <span className="font-black text-[#b7f34a]">{progress.percent}%</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#1b281f]">
            <div className="h-full rounded-full bg-[#b7f34a] transition-all duration-500" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#839289]">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#34413b] px-2 py-1"><Gauge size={12} /> {progress.completedSteps}/{progress.totalSteps} etapas</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#34413b] px-2 py-1"><ShieldCheck size={12} /> progresso por usuário</span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[#2b3931] bg-[linear-gradient(135deg,rgba(183,243,74,.08),rgba(11,16,14,.95))] p-4">
          <div className="text-[10px] font-black uppercase tracking-[.16em] text-[#728178]">Módulo atual</div>
          <div className="mt-2 text-lg font-black text-white">
            {progress.currentModule ? `${progress.currentModule.code} — ${progress.currentModule.title}` : "Trilha concluída"}
          </div>
          <p className="mt-2 text-xs leading-5 text-[#92a199]">{progress.currentModule?.summary || "Novos módulos poderão ser liberados futuramente."}</p>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">
          <Route size={15} />
          Trilha de evolução
        </div>
        <div className="mt-4 grid gap-3">
          {progress.modules.map((module) => {
            const active = selectedStep?.moduleId === module.id;
            return <button
              type="button"
              key={module.id}
              disabled={module.status === "locked"}
              onClick={() => setSelectedStepId(module.steps.find((step) => !progress.completedStepIds.includes(step.id))?.id || module.steps[0]?.id || null)}
              className={`group relative rounded-2xl border p-4 text-left transition ${active ? "border-[#b7f34a]/60 bg-[#172314]" : module.status === "locked" ? "cursor-not-allowed border-[#26312c] bg-[#0b100e] opacity-65" : "border-[#26312c] bg-[#0b100e] hover:border-[#b7f34a]/35"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-xs font-black ${module.status === "completed" ? "border-[#b7f34a] bg-[#b7f34a] text-[#09120d]" : active ? "border-[#b7f34a]/60 text-[#b7f34a]" : "border-[#34413b] text-[#77867e]"}`}>{module.code}</div>
                  <div>
                    <h3 className="text-sm font-black text-[#edf5f0]">{module.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-[#84938b]">{module.summary}</p>
                  </div>
                </div>
                <span className="shrink-0 text-[#b7f34a]">
                  {module.status === "completed" ? <CheckCircle2 size={16} /> : module.status === "locked" ? <Lock size={16} /> : <Gauge size={16} />}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[.12em] text-[#728178]">
                <span>{statusLabel(module.status)}</span>
                <span>{module.percent}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1b281f]">
                <div className="h-full rounded-full bg-[#b7f34a]" style={{ width: `${module.percent}%` }} />
              </div>
            </button>;
          })}
        </div>
      </div>

      <div className="space-y-4">
        {loading && <div className="rounded-3xl border border-[#26312c] bg-[#101613] p-6 text-sm text-[#9aaaa2]">Carregando trilha técnica...</div>}
        {message && <div className="rounded-2xl border border-[#5a4024] bg-[#1a1309] px-4 py-3 text-xs font-bold text-[#f0c98a]">{message}</div>}
        {!loading && <VetorCADAcademyStep
          step={selectedStep as AcademyStep | null}
          completed={completed}
          locked={locked}
          saving={savingStepId === selectedStep?.id}
          onComplete={completeStep}
        />}

        <div className="rounded-3xl border border-[#26312c] bg-[#101613] p-5">
          <div className="text-xs font-black uppercase tracking-[.16em] text-[#728178]">Histórico de progresso</div>
          <div className="mt-4 grid gap-2">
            {progress.completedStepIds.length ? progress.completedStepIds.slice(-5).reverse().map((stepId) => <div key={stepId} className="flex items-center gap-2 rounded-xl border border-[#26312c] bg-[#0b100e] px-3 py-2 text-xs text-[#a8b7af]">
              <CheckCircle2 size={14} className="text-[#b7f34a]" />
              {stepId.replace(/-/g, " ")}
            </div>) : <p className="text-sm leading-6 text-[#84938b]">Nenhuma etapa concluída ainda. Comece pelo módulo Fundamentos do VetorCAD.</p>}
          </div>
        </div>
      </div>
    </div>
  </section>;
}

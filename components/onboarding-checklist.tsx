import { Check, Circle } from "lucide-react";

type OnboardingChecklistProps = {
  emailConfirmed: boolean;
  hasProject: boolean;
  hasFile: boolean;
  hasAnalysis: boolean;
};

export function OnboardingChecklist({ emailConfirmed, hasProject, hasFile, hasAnalysis }: OnboardingChecklistProps) {
  const items = [
    ["Conta criada", true],
    ["E-mail confirmado", emailConfirmed],
    ["Criar primeiro projeto", hasProject],
    ["Enviar primeiro arquivo", hasFile],
    ["Gerar primeira análise", hasAnalysis],
  ] as const;

  return <section className="rounded-3xl border border-[#26312c] bg-[#101613] p-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">Seu início no VetorCAD</div>
        <p className="mt-2 text-xs text-[#8c9a93]">Acompanhe seu progresso para começar.</p>
      </div>
      <span className="rounded-full border border-[#34413b] px-3 py-1 text-[10px] font-black text-[#9caaa3]">{items.filter(([, done]) => done).length}/{items.length}</span>
    </div>
    <div className="mt-5 grid gap-2 sm:grid-cols-2">
      {items.map(([label, done]) => <div key={label} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${done ? "border-[#b7f34a]/25 bg-[#172314] text-[#dfffc0]" : "border-[#26312c] bg-[#0b100e] text-[#829087]"}`}>
        {done ? <Check size={15} className="shrink-0 text-[#b7f34a]" /> : <Circle size={15} className="shrink-0 text-[#53645a]" />}
        <span>{label}</span>
      </div>)}
    </div>
  </section>;
}

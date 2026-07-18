import { ArrowRight, CheckCircle2, FileUp, FolderKanban, Sparkles } from "lucide-react";

type OnboardingModalProps = {
  saving: boolean;
  message?: string;
  onStart: () => void;
};

const steps = [
  { icon: FileUp, title: "Envie seu arquivo", text: "Faça upload do seu DXF ou DWG para iniciar a análise inteligente." },
  { icon: Sparkles, title: "Analise seu projeto", text: "Identifique informações técnicas, elementos e dados importantes do desenho." },
  { icon: FolderKanban, title: "Organize seus resultados", text: "Gere relatórios e mantenha seus projetos centralizados." },
];

export function OnboardingModal({ saving, message, onStart }: OnboardingModalProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="onboarding-title" className="w-full max-w-3xl rounded-[2rem] border border-[#b7f34a]/30 bg-[#101613] p-6 shadow-2xl shadow-black/60 sm:p-8">
        <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#b7f34a] text-[#09120d]"><Sparkles size={17} /></span>
          Primeiros passos
        </div>
        <h2 id="onboarding-title" className="mt-5 text-3xl font-black tracking-[-.04em] text-white sm:text-4xl">Bem-vindo ao VetorCAD 🚀</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#aebeb6]">Sua plataforma inteligente para análise e organização de projetos de engenharia.</p>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <article key={title} className="rounded-2xl border border-[#2a3931] bg-[#0b100e] p-4">
              <div className="flex items-center justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#172314] text-[#b7f34a]"><Icon size={18} /></div>
                <span className="text-xs font-black text-[#65756b]">0{index + 1}</span>
              </div>
              <h3 className="mt-4 text-sm font-black text-[#eef5f1]">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-[#8f9e96]">{text}</p>
            </article>
          ))}
        </div>

        <button type="button" onClick={onStart} disabled={saving} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-[#b7f34a] px-5 py-3.5 text-sm font-black text-[#09120d] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? "Preparando seu workspace..." : "Começar meu primeiro projeto"}
          {!saving && <ArrowRight size={17} />}
        </button>
        {message && <p className="mt-3 text-center text-xs text-[#ffb3b3]">{message}</p>}
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] text-[#718078]"><CheckCircle2 size={13} className="text-[#b7f34a]" /> Você poderá continuar de onde parou sempre que voltar.</p>
      </section>
    </div>
  );
}

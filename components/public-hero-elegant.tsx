import Link from "next/link";
import styles from "./public-hero-elegant.module.css";

export function PublicHeroElegant() {
  return (
    <section className="relative overflow-hidden border-b border-[#1c2822] bg-[#070b09]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_34%,rgba(183,243,74,.10),transparent_30%),linear-gradient(180deg,#070b09_0%,#050807_100%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:py-28">
        <div className={styles.hero}>
          <div className="mb-7 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#b7f34a] text-sm font-black text-[#07100a] shadow-[0_0_28px_rgba(183,243,74,.18)]">VC</span>
            <div><div className="text-sm font-black tracking-[.12em] text-[#edf5f0]">VectorCAD</div><div className="text-[10px] uppercase tracking-[.22em] text-[#7f9188]">Intelligent engineering workspace</div></div>
          </div>
          <span className="inline-flex rounded-full border border-[#b7f34a]/35 bg-[#b7f34a]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.16em] text-[#b7f34a]">NOVO IA integrada</span>
          <h1 className="mt-7 max-w-2xl text-5xl font-black leading-[1.02] tracking-[-.06em] text-[#f1f7f3] md:text-7xl">A inteligencia aplicada aos seus projetos de engenharia.</h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[#aebeb6]">Transforme desenhos tecnicos em informacao organizada, vetores editaveis e decisoes mais rapidas para o seu time.</p>
          <div className="mt-9 flex flex-wrap items-center gap-4"><Link href="/signup" className="rounded-2xl bg-[#b7f34a] px-6 py-4 text-sm font-black text-[#07100a] shadow-[0_0_30px_rgba(183,243,74,.14)] transition duration-300 hover:-translate-y-0.5 hover:brightness-105">Teste o VectorCAD AI</Link><Link href="/sobre" className="text-sm font-bold text-[#b8c8c0] transition hover:text-[#b7f34a]">Conheca a plataforma <span aria-hidden="true">→</span></Link></div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-[#819188]"><span><span className="mr-2 text-[#b7f34a]">●</span>OCR e analise visual</span><span><span className="mr-2 text-[#b7f34a]">●</span>SVG e DXF editaveis</span><span><span className="mr-2 text-[#b7f34a]">●</span>Workspace para engenharia</span></div>
        </div>

        <div className={`${styles.mockup} relative mx-auto w-full max-w-2xl`}>
          <div className={`${styles.mockupGlow} pointer-events-none absolute -inset-8 rounded-[3rem] bg-[#b7f34a]/10 blur-3xl`} />
          <div className="relative overflow-hidden rounded-[2rem] border border-[#304238] bg-[#0b120e] shadow-2xl shadow-black/45">
            <div className="flex items-center justify-between border-b border-[#223028] px-5 py-4"><div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#b7f34a] shadow-[0_0_12px_#b7f34a]" /><span className="text-xs font-black text-[#edf5f0]">VectorCAD AI</span></div><span className="rounded-full border border-[#b7f34a]/30 bg-[#b7f34a]/10 px-3 py-1 text-[10px] font-black text-[#b7f34a]">Workspace</span></div>
            <div className="grid gap-0 md:grid-cols-[.35fr_1fr]">
              <div className="hidden border-r border-[#223028] bg-[#09100c] p-4 md:block"><div className="mb-5 h-2 w-16 rounded-full bg-[#b7f34a]/70" /><div className="space-y-2 text-[10px] font-bold text-[#7f9188]"><div className="rounded-lg bg-[#b7f34a]/10 px-3 py-2 text-[#b7f34a]">Projeto atual</div><div className="px-3 py-2">Camadas</div><div className="px-3 py-2">Analise IA</div><div className="px-3 py-2">Exportacoes</div></div><div className="mt-16 rounded-xl border border-[#223028] p-3"><div className="text-[9px] uppercase tracking-[.16em] text-[#718279]">Status</div><div className="mt-2 text-xs font-black text-[#b7f34a]">Pronto para revisar</div></div></div>
              <div className="p-4 sm:p-6"><div className="mb-4 flex items-end justify-between"><div><div className="text-[10px] uppercase tracking-[.16em] text-[#718279]">Preview tecnico</div><div className="mt-1 text-lg font-black text-[#edf5f0]">Planta industrial</div></div><div className="text-right text-[10px] text-[#718279]"><div>SVG + DXF</div><div className="mt-1 text-[#b7f34a]">94% confianca</div></div></div>
                <div className="relative h-64 overflow-hidden rounded-2xl border border-[#26382e] bg-[#070c09] p-5 sm:h-72"><div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(#173022_1px,transparent_1px),linear-gradient(90deg,#173022_1px,transparent_1px)] [background-size:22px_22px]" /><div className="absolute inset-[16%] border-2 border-[#b7f34a]/80 shadow-[0_0_16px_rgba(183,243,74,.08)]" /><div className="absolute left-[50%] top-[16%] h-[68%] w-px bg-[#6bdcff]/85" /><div className="absolute left-[16%] top-[52%] h-px w-[34%] bg-[#6bdcff]/85" /><div className="absolute left-[27%] top-[32%] h-12 w-12 rounded-full border-2 border-[#ffca5c]/90" /><div className="absolute right-[22%] top-[32%] h-7 w-7 rounded-full border-2 border-[#ffca5c]/90" /><div className="absolute left-[23%] top-[41%] rounded border border-[#54e58b]/80 px-2 py-1 font-mono text-[8px] text-[#54e58b]">SALA TECNICA</div><div className="absolute bottom-[12%] right-[18%] rounded border border-[#54e58b]/80 px-2 py-1 font-mono text-[8px] text-[#54e58b]">P-101</div><div className="absolute bottom-3 left-4 rounded-md bg-[#0d1710]/90 px-2 py-1 text-[9px] font-bold text-[#718279]">Escala 1:1 · mm</div></div>
                <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-[#101913] p-3"><div className="text-[9px] uppercase tracking-[.12em] text-[#718279]">Linhas</div><div className="mt-1 text-base font-black text-[#edf5f0]">42</div></div><div className="rounded-xl bg-[#101913] p-3"><div className="text-[9px] uppercase tracking-[.12em] text-[#718279]">Objetos</div><div className="mt-1 text-base font-black text-[#edf5f0]">18</div></div><div className="rounded-xl bg-[#101913] p-3"><div className="text-[9px] uppercase tracking-[.12em] text-[#718279]">Reducao</div><div className="mt-1 text-base font-black text-[#b7f34a]">78%</div></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

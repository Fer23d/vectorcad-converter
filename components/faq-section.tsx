"use client";

import { useEffect, useRef, useState } from "react";

const questions = [
  {
    question: "Por que VectorCAD não é apenas um SVG bonito?",
    answer: "Porque o resultado é pensado para uso técnico: geometrias editáveis, escala coerente, contornos fechados quando possível e menos pontos desnecessários. Isso reduz o retrabalho depois da importação no CAD.",
  },
  {
    question: "O VectorCAD substitui um desenhista CAD?",
    answer: "O VectorCAD reduz o redesenho manual em imagens simples, logos e contornos. Em desenhos complexos, ainda pode ser necessário revisar e ajustar o arquivo final.",
  },
  {
    question: "O DXF abre no AutoCAD?",
    answer: "Sim. A exportação usa entidades editáveis, como polilinhas e layers, pensadas para importação em AutoCAD e fluxos CAD/CAM.",
  },
  {
    question: "Qual imagem gera melhor resultado?",
    answer: "Imagens com fundo simples, alto contraste, poucas sombras e bordas bem definidas geram vetores mais limpos. PNG, JPG e TIFF em boa resolução são ótimos pontos de partida.",
  },
  {
    question: "Consigo usar para corte a laser?",
    answer: "Sim. O modo simplificado ajuda a reduzir pontos e manter contornos mais adequados para corte CNC e laser. Sempre revise a escala e os caminhos antes de fabricar.",
  },
];

export function FAQSection() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [visibleItems, setVisibleItems] = useState<boolean[]>(() => questions.map(() => false));
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      setVisibleItems((current) => {
        const next = [...current];
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number((entry.target as HTMLElement).dataset.faqIndex);
          if (!Number.isNaN(index)) next[index] = true;
          observer.unobserve(entry.target);
        });
        return next;
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -8%" });

    itemRefs.current.forEach((element) => {
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <section id="faq" className="relative overflow-hidden border-y border-[#1c2822] bg-[#070b09]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_45%,rgba(183,243,74,.08),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(53,214,160,.06),transparent_28%)]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[.8fr_1.2fr] lg:px-8 lg:py-24">
        <div className="self-start lg:sticky lg:top-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#b7f34a]/35 bg-[#b7f34a]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.16em] text-[#b7f34a]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#b7f34a] shadow-[0_0_10px_#b7f34a]" /> Dúvidas frequentes
          </span>
          <h2 className="mt-6 max-w-lg text-3xl font-black leading-tight tracking-[-.04em] text-[#f2f8f4] md:text-5xl">Antes de começar, tire suas dúvidas.</h2>
          <p className="mt-5 max-w-md text-base leading-7 text-[#aebeb6]">Desça pela seção e abra as respostas que mais interessam ao seu fluxo de trabalho técnico.</p>
          <div className="mt-8 hidden h-24 w-px bg-gradient-to-b from-[#b7f34a] via-[#b7f34a]/40 to-transparent lg:block" aria-hidden="true" />
        </div>

        <div className="grid gap-3" aria-label="Perguntas frequentes">
          {questions.map((item, index) => {
            const isOpen = activeIndex === index;
            const isVisible = visibleItems[index];
            return (
              <article
                key={item.question}
                ref={(element) => { itemRefs.current[index] = element; }}
                data-faq-index={index}
                className={`rounded-2xl border p-1 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"} ${isOpen ? "border-[#b7f34a]/65 bg-[#101a15] shadow-[0_0_30px_rgba(183,243,74,.08)]" : "border-[#223028] bg-[#0d1411] hover:border-[#b7f34a]/35"}`}
                style={{ transitionDelay: `${index * 90}ms` }}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left sm:px-5"
                  onClick={() => setActiveIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${index}`}
                >
                  <span className={`font-mono text-xs font-bold transition-colors ${isOpen ? "text-[#b7f34a]" : "text-[#63776b]"}`}>0{index + 1}</span>
                  <span className="flex-1 text-sm font-black leading-6 text-[#edf5f0] sm:text-base">{item.question}</span>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all duration-300 ${isOpen ? "rotate-45 border-[#b7f34a] bg-[#b7f34a] text-[#07100a]" : "border-[#405447] text-[#b7f34a]"}`} aria-hidden="true">
                    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3v10M3 8h10" /></svg>
                  </span>
                </button>
                <div id={`faq-answer-${index}`} className={`grid transition-[grid-template-rows] duration-500 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="min-h-0 overflow-hidden">
                    <p className="border-t border-[#b7f34a]/15 px-12 pb-5 pt-4 text-sm leading-7 text-[#aebeb6] sm:px-16">{item.answer}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

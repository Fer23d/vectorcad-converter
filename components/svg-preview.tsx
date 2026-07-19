"use client";

import { useState } from "react";

export function SVGPreview({ scrollProgress = 0 }: { scrollProgress?: number }) {
  const [activeLayer, setActiveLayer] = useState<"all" | "contours" | "details">("all");
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const drawProgress = Math.min(1, 0.18 + scrollProgress * 1.6);
  const drawOffset = 700 - drawProgress * 700;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-[#33483a] bg-[#070b09] p-3 shadow-2xl shadow-black/40">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(183,243,74,.12),transparent_52%)]" />
      <div className="relative rounded-[1.5rem] border border-[#26382e] bg-[#0b120f] p-4">
        <div className="mb-4 flex items-center justify-between text-[10px] font-black uppercase tracking-[.16em] text-[#90a39a]">
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#b7f34a] shadow-[0_0_10px_#b7f34a]" /> Preview técnico</span>
          <span>SVG / DXF</span>
        </div>
        <div className="relative grid min-h-[310px] place-items-center overflow-hidden rounded-2xl border border-[#1e2d25] bg-[linear-gradient(45deg,#101914_25%,transparent_25%),linear-gradient(-45deg,#101914_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#101914_75%),linear-gradient(-45deg,transparent_75%,#101914_75%)] bg-[length:28px_28px] bg-[position:0_0,0_14px,14px_-14px,-14px_0]">
          {hoveredElement && <div className="pointer-events-none absolute right-3 top-3 z-10 max-w-[180px] rounded-xl border border-[#b7f34a]/40 bg-[#07100a]/90 px-3 py-2 text-[10px] font-bold leading-4 text-[#dce8e2] shadow-xl backdrop-blur"><span className="block text-[#b7f34a]">Elemento técnico</span>{hoveredElement}</div>}
          <svg viewBox="0 0 520 330" className="h-full w-full max-w-[520px] p-5" role="img" aria-label="Planta técnica vetorizada">
            <g className="text-[#b7f34a]" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path onMouseEnter={() => setHoveredElement("Contorno principal · 12 pontos")} onMouseLeave={() => setHoveredElement(null)} className={activeLayer === "details" ? "cursor-help opacity-20 transition" : "cursor-help transition"} d="M62 68h160v54h88V68h142v194H310v-52h-88v52H62z" strokeDasharray="700" strokeDashoffset={drawOffset} />
              <path onMouseEnter={() => setHoveredElement("Linhas de contorno · Layer principal")} onMouseLeave={() => setHoveredElement(null)} className={activeLayer === "contours" ? "cursor-help opacity-100 transition" : "cursor-help opacity-60 transition"} d="M62 68h160v54h88V68h142M62 262h160v-52h88v52h142" />
              <path onMouseEnter={() => setHoveredElement("Divisórias · 10 segmentos")} onMouseLeave={() => setHoveredElement(null)} className={activeLayer === "details" ? "cursor-help transition" : "cursor-help opacity-70 transition"} d="M222 68v54M310 122v88M222 210v52M310 68v54M398 68v194" />
              <circle onMouseEnter={() => setHoveredElement("Símbolo circular · Layer detalhes")} onMouseLeave={() => setHoveredElement(null)} className="cursor-help" cx="156" cy="164" r="34" /><path d="M122 164h68M156 130v68" />
              <rect onMouseEnter={() => setHoveredElement("Equipamento · Confiança 92%")} onMouseLeave={() => setHoveredElement(null)} className="cursor-help" x="338" y="154" width="36" height="30" rx="3" />
              <path d="M338 169h-28M374 169h28M356 154v-22M356 184v22" />
            </g>
            <g fill="#f2f8f4" fontSize="13" fontFamily="monospace" className={activeLayer === "contours" ? "opacity-60" : "opacity-100"}>
              <text x="86" y="102">SALA</text><text x="330" y="236">P-101</text><text x="238" y="58">3500</text>
            </g>
            <g fill="#b7f34a"><circle cx="62" cy="68" r="5" /><circle cx="310" cy="122" r="5" /><circle cx="442" cy="262" r="5" /></g>
          </svg>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#b8c8c0]">
          {(["all", "contours", "details"] as const).map((layer) => (
            <button key={layer} type="button" onClick={() => setActiveLayer(layer)} className={`rounded-xl border px-3 py-2 transition ${activeLayer === layer ? "border-[#b7f34a]/70 bg-[#b7f34a]/15 text-[#b7f34a]" : "border-[#26382e] hover:border-[#b7f34a]/40"}`}>
              {layer === "all" ? "Layers" : layer === "contours" ? "Contours" : "Detalhes"}
            </button>
          ))}
          <span className="ml-auto rounded-xl border border-[#26382e] px-3 py-2 text-[#90a39a]">Escala: mm</span>
        </div>
      </div>
    </div>
  );
}

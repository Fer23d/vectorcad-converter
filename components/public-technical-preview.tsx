"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

type PreviewMode = "original" | "processed" | "vector";
type Unit = "mm" | "cm" | "px";

type DemoObject = {
  id: string;
  name: string;
  type: "LINE" | "ARC" | "CIRCLE" | "POLYLINE";
  layer: "CONTOURS" | "DETAILS" | "GUIDES";
  points: number;
  confidence: number;
  d: string;
  pointsForDxf: Array<[number, number]>;
};

type TooltipState = { id: string; x: number; y: number } | null;

const demoObjects: DemoObject[] = [
  { id: "wall-north", name: "Parede externa norte", type: "LINE", layer: "CONTOURS", points: 2, confidence: 0.99, d: "M 90 92 H 680", pointsForDxf: [[90, 92], [680, 92]] },
  { id: "wall-east", name: "Parede externa leste", type: "LINE", layer: "CONTOURS", points: 2, confidence: 0.98, d: "M 680 92 V 372", pointsForDxf: [[680, 92], [680, 372]] },
  { id: "wall-south", name: "Parede externa sul", type: "LINE", layer: "CONTOURS", points: 2, confidence: 0.99, d: "M 680 372 H 90", pointsForDxf: [[680, 372], [90, 372]] },
  { id: "wall-west", name: "Parede externa oeste", type: "LINE", layer: "CONTOURS", points: 2, confidence: 0.98, d: "M 90 372 V 92", pointsForDxf: [[90, 372], [90, 92]] },
  { id: "wall-mid", name: "Divisoria principal", type: "LINE", layer: "DETAILS", points: 2, confidence: 0.96, d: "M 390 92 V 372", pointsForDxf: [[390, 92], [390, 372]] },
  { id: "wall-cross", name: "Divisoria transversal", type: "LINE", layer: "DETAILS", points: 2, confidence: 0.95, d: "M 90 238 H 390", pointsForDxf: [[90, 238], [390, 238]] },
  { id: "door-left", name: "Porta de acesso", type: "ARC", layer: "DETAILS", points: 12, confidence: 0.9, d: "M 182 238 A 92 92 0 0 1 90 146", pointsForDxf: [[182, 238], [90, 146]] },
  { id: "door-right", name: "Porta interna", type: "ARC", layer: "DETAILS", points: 12, confidence: 0.91, d: "M 390 288 A 50 50 0 0 1 440 238", pointsForDxf: [[390, 288], [440, 238]] },
  { id: "equipment-1", name: "Equipamento tecnico", type: "CIRCLE", layer: "GUIDES", points: 32, confidence: 0.87, d: "M 530 180 a 34 34 0 1 0 .1 0", pointsForDxf: [[530, 180], [564, 180]] },
  { id: "equipment-2", name: "Ponto de inspecao", type: "CIRCLE", layer: "GUIDES", points: 32, confidence: 0.88, d: "M 530 300 a 22 22 0 1 0 .1 0", pointsForDxf: [[530, 300], [552, 300]] },
  { id: "dimension-top", name: "Cota horizontal", type: "LINE", layer: "GUIDES", points: 2, confidence: 0.93, d: "M 90 58 H 680 M 90 48 V 68 M 680 48 V 68", pointsForDxf: [[90, 58], [680, 58]] },
];

const layerColors: Record<DemoObject["layer"], string> = {
  CONTOURS: "#b7f34a",
  DETAILS: "#64d9ff",
  GUIDES: "#ffca5c",
};

function downloadDemo(kind: "svg" | "dxf") {
  const content = kind === "svg"
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 470"><g fill="none" stroke="#111" stroke-width="2">${demoObjects.map((object) => `<path d="${object.d}"/>`).join("")}</g></svg>`
    : `0\nSECTION\n2\nENTITIES\n${demoObjects.map((object) => `0\nLWPOLYLINE\n8\n${object.layer}\n90\n${object.pointsForDxf.length}\n${object.pointsForDxf.map(([x, y]) => `10\n${x}\n20\n${y}`).join("\n")}`).join("\n")}\n0\nENDSEC\n0\nEOF\n`;
  const blob = new Blob([content], { type: kind === "svg" ? "image/svg+xml" : "application/dxf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `vectorcad-preview.${kind}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PublicTechnicalPreview() {
  const [mode, setMode] = useState<PreviewMode>("vector");
  const [unit, setUnit] = useState<Unit>("mm");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showContours, setShowContours] = useState(true);
  const [showLayers, setShowLayers] = useState(true);
  const [showTexts, setShowTexts] = useState(true);
  const [showAi, setShowAi] = useState(true);
  const [selectedId, setSelectedId] = useState("wall-north");
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [isPanning, setIsPanning] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  const selectedObject = useMemo(() => demoObjects.find((object) => object.id === selectedId), [selectedId]);

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if ((event.target as SVGElement).closest("[data-vector-object]")) return;
    setIsPanning(true);
    dragStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!isPanning) return;
    setPan({ x: dragStart.current.panX + event.clientX - dragStart.current.x, y: dragStart.current.panY + event.clientY - dragStart.current.y });
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    setZoom((current) => Math.min(2.8, Math.max(0.65, current + (event.deltaY > 0 ? -0.12 : 0.12))));
  }

  function showObjectTooltip(event: React.MouseEvent<SVGPathElement>, object: DemoObject) {
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setTooltip({ id: object.id, x: event.clientX - bounds.left + 12, y: event.clientY - bounds.top + 12 });
  }

  return (
    <section className="border-b border-[#1c2822] bg-[#050807] px-4 py-16 lg:px-8 lg:py-24" aria-labelledby="technical-preview-title">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[.76fr_1.24fr] lg:gap-14">
        <div>
          <span className="inline-flex rounded-full border border-[#b7f34a]/40 bg-[#b7f34a]/10 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">Preview Tecnico</span>
          <h2 id="technical-preview-title" className="mt-6 max-w-xl text-4xl font-black leading-[1.05] tracking-[-.05em] md:text-6xl">Veja seu desenho virar CAD antes mesmo de criar sua conta.</h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#b8c8c0]">Explore contornos, layers, textos detectados e analise visual em um preview interativo criado para fluxos de engenharia, CNC e projetos tecnicos.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-2xl bg-[#b7f34a] px-6 py-4 text-sm font-black text-[#07100a] shadow-[0_0_32px_rgba(183,243,74,.16)] transition hover:-translate-y-0.5 hover:brightness-105">Criar conta gratis</Link>
            <Link href="/login" className="rounded-2xl border border-[#304238] px-6 py-4 text-sm font-black text-[#edf5f0] transition hover:-translate-y-0.5 hover:border-[#b7f34a]/60 hover:bg-[#111915]">Ja tenho uma conta</Link>
          </div>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-3 text-xs text-[#8ea098]">
            <div><strong className="block text-lg text-[#edf5f0]">42</strong>linhas detectadas</div>
            <div><strong className="block text-lg text-[#edf5f0]">18</strong>objetos CAD</div>
            <div><strong className="block text-lg text-[#edf5f0]">94%</strong>confianca media</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-[#304238] bg-[#0b120e] shadow-2xl shadow-black/40">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#223028] px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-black text-[#edf5f0]"><span className="h-2 w-2 rounded-full bg-[#b7f34a] shadow-[0_0_12px_#b7f34a]" /> Preview Tecnico <span className="font-normal text-[#718279]">/ planta-demo.svg</span></div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#8ea098]"><span>Zoom {Math.round(zoom * 100)}%</span><span className="text-[#304238]">|</span><span>Escala 1:1</span></div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_210px]">
            <div className="min-w-0 border-b border-[#223028] lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-center gap-2 border-b border-[#223028] p-3">
                {(["original", "processed", "vector"] as PreviewMode[]).map((item) => (
                  <button key={item} type="button" onClick={() => setMode(item)} className={`rounded-lg px-3 py-2 text-[11px] font-black transition ${mode === item ? "bg-[#b7f34a] text-[#07100a]" : "bg-[#121b16] text-[#9eb0a7] hover:text-[#edf5f0]"}`}>
                    {item === "original" ? "Original" : item === "processed" ? "Processada" : "Vetor"}
                  </button>
                ))}
                <button type="button" onClick={() => setUnit((current) => current === "mm" ? "cm" : current === "cm" ? "px" : "mm")} className="ml-auto rounded-lg border border-[#304238] px-3 py-2 text-[11px] font-black text-[#b7f34a] transition hover:bg-[#121b16]">Escala: {unit}</button>
              </div>
              <div ref={viewportRef} className="relative h-[380px] overflow-hidden bg-[#060a08] sm:h-[450px]">
                <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(#142019_1px,transparent_1px),linear-gradient(90deg,#142019_1px,transparent_1px)] [background-size:24px_24px]" />
                <svg viewBox="0 0 760 470" className={`relative h-full w-full touch-none ${isPanning ? "cursor-grabbing" : "cursor-grab"}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => setIsPanning(false)} onPointerCancel={() => setIsPanning(false)} onWheel={handleWheel} onClick={() => setSelectedId("")} role="img" aria-label="Preview interativo de desenho tecnico">
                  <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                    <rect x="0" y="0" width="760" height="470" fill="#07100a" opacity={mode === "original" ? 0.8 : 0.25} />
                    {showContours && demoObjects.map((object) => {
                      const isSelected = object.id === selectedId;
                      const stroke = showLayers ? layerColors[object.layer] : "#b7f34a";
                      const opacity = mode === "original" ? 0.24 : mode === "processed" ? 0.68 : 1;
                      return <path key={object.id} data-vector-object="true" d={object.d} fill="none" stroke={stroke} strokeWidth={isSelected ? 4 : 2} strokeLinecap="round" opacity={opacity} className="transition-all duration-200 hover:stroke-white hover:opacity-100" onClick={(event) => { event.stopPropagation(); setSelectedId(object.id); }} onMouseEnter={(event) => showObjectTooltip(event, object)} onMouseMove={(event) => showObjectTooltip(event, object)} onMouseLeave={() => setTooltip(null)} />;
                    })}
                    {showTexts && <g fill="#f1f7f3" fontFamily="monospace" fontSize="14" fontWeight="700" opacity={mode === "original" ? 0.35 : 1}><text x="135" y="180">SALA TECNICA</text><text x="450" y="145">P-101</text><text x="470" y="350">3500 mm</text></g>}
                    {showAi && <g fill="none" stroke="#54e58b" strokeDasharray="5 4" strokeWidth="1.5"><rect x="128" y="157" width="135" height="31" rx="5" /><rect x="442" y="125" width="62" height="28" rx="5" /><rect x="462" y="330" width="87" height="28" rx="5" /></g>}
                  </g>
                </svg>
                <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-[#304238] bg-[#07100a]/90 px-3 py-2 text-[10px] font-black uppercase tracking-[.14em] text-[#b7f34a]">{mode === "vector" ? "Vetor editavel" : mode === "processed" ? "Imagem processada" : "Imagem original"}</div>
                {tooltip && <div className="pointer-events-none absolute z-10 max-w-[190px] rounded-xl border border-[#496052] bg-[#07100a]/95 p-3 text-xs shadow-xl" style={{ left: Math.min(tooltip.x, 250), top: Math.min(tooltip.y, 310) }}><strong className="block text-[#b7f34a]">{demoObjects.find((item) => item.id === tooltip.id)?.name}</strong><span className="mt-1 block text-[#b8c8c0]">Passe o mouse para inspecionar</span></div>}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-[#223028] p-3">
                {[{ label: "Contours", value: showContours, setter: setShowContours }, { label: "Layers", value: showLayers, setter: setShowLayers }, { label: "Textos", value: showTexts, setter: setShowTexts }, { label: "Visual AI Overlay", value: showAi, setter: setShowAi }].map((toggle) => <button key={toggle.label} type="button" aria-pressed={toggle.value} onClick={() => toggle.setter(!toggle.value)} className={`rounded-lg border px-2.5 py-2 text-[10px] font-black transition ${toggle.value ? "border-[#b7f34a]/60 bg-[#b7f34a]/10 text-[#b7f34a]" : "border-[#304238] text-[#718279] hover:text-[#edf5f0]"}`}>{toggle.label}</button>)}
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-[#223028] p-3 sm:grid-cols-4">
                {["Linhas detectadas|42", "Objetos|18", "Reducao|78%", "Confianca media|94%"].map((metric) => { const [label, value] = metric.split("|"); return <div key={label} className="rounded-xl bg-[#101913] px-3 py-2"><span className="block text-[9px] font-black uppercase tracking-[.12em] text-[#718279]">{label}</span><strong className="text-sm text-[#edf5f0]">{value}</strong></div>; })}
              </div>
            </div>

            <aside className="flex flex-col bg-[#0d1510] p-4" aria-label="Propriedades do objeto selecionado">
              <div className="flex items-center justify-between"><h3 className="text-sm font-black text-[#edf5f0]">Propriedades</h3><span className="rounded-full bg-[#b7f34a]/10 px-2 py-1 text-[9px] font-black text-[#b7f34a]">CAD</span></div>
              <div className="mt-4 space-y-3 text-xs">
                <div><span className="block text-[#718279]">Tipo</span><strong className="text-[#edf5f0]">{selectedObject?.type ?? "Nenhum objeto"}</strong></div>
                <div><span className="block text-[#718279]">Layer</span><strong style={{ color: selectedObject ? layerColors[selectedObject.layer] : "#edf5f0" }}>{selectedObject?.layer ?? "-"}</strong></div>
                <div><span className="block text-[#718279]">Pontos</span><strong className="text-[#edf5f0]">{selectedObject?.points ?? "-"}</strong></div>
                <div><span className="block text-[#718279]">Confianca</span><strong className="text-[#edf5f0]">{selectedObject ? `${Math.round(selectedObject.confidence * 100)}%` : "-"}</strong></div>
              </div>
              <div className="mt-auto space-y-2 pt-8"><button type="button" onClick={() => downloadDemo("svg")} className="w-full rounded-xl bg-[#b7f34a] px-3 py-2.5 text-xs font-black text-[#07100a] transition hover:brightness-105">Exportar SVG</button><button type="button" onClick={() => downloadDemo("dxf")} className="w-full rounded-xl border border-[#496052] px-3 py-2.5 text-xs font-black text-[#edf5f0] transition hover:border-[#b7f34a] hover:text-[#b7f34a]">Exportar DXF</button></div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}

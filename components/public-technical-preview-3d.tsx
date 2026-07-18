"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

type DisplayMode = "original" | "processed" | "vector";
type Unit = "mm" | "cm" | "px";
type Layer = "CONTOURS" | "DETAILS" | "GUIDES";

type PreviewObject = {
  id: string;
  name: string;
  type: "LINE" | "ARC" | "CIRCLE" | "POLYLINE";
  layer: Layer;
  points: number;
  confidence: number;
  d: string;
  dxfPoints: Array<[number, number]>;
};

type Tooltip = { id: string; x: number; y: number } | null;

const objects: PreviewObject[] = [
  { id: "north", name: "Parede externa norte", type: "LINE", layer: "CONTOURS", points: 2, confidence: .99, d: "M 90 92 H 680", dxfPoints: [[90, 92], [680, 92]] },
  { id: "east", name: "Parede externa leste", type: "LINE", layer: "CONTOURS", points: 2, confidence: .98, d: "M 680 92 V 372", dxfPoints: [[680, 92], [680, 372]] },
  { id: "south", name: "Parede externa sul", type: "LINE", layer: "CONTOURS", points: 2, confidence: .99, d: "M 680 372 H 90", dxfPoints: [[680, 372], [90, 372]] },
  { id: "west", name: "Parede externa oeste", type: "LINE", layer: "CONTOURS", points: 2, confidence: .98, d: "M 90 372 V 92", dxfPoints: [[90, 372], [90, 92]] },
  { id: "middle", name: "Divisoria principal", type: "LINE", layer: "DETAILS", points: 2, confidence: .96, d: "M 390 92 V 372", dxfPoints: [[390, 92], [390, 372]] },
  { id: "cross", name: "Divisoria transversal", type: "LINE", layer: "DETAILS", points: 2, confidence: .95, d: "M 90 238 H 390", dxfPoints: [[90, 238], [390, 238]] },
  { id: "door", name: "Porta de acesso", type: "ARC", layer: "DETAILS", points: 12, confidence: .9, d: "M 182 238 A 92 92 0 0 1 90 146", dxfPoints: [[182, 238], [90, 146]] },
  { id: "equipment", name: "Equipamento tecnico", type: "CIRCLE", layer: "GUIDES", points: 32, confidence: .87, d: "M 530 180 a 34 34 0 1 0 .1 0", dxfPoints: [[530, 180], [564, 180]] },
  { id: "inspection", name: "Ponto de inspecao", type: "CIRCLE", layer: "GUIDES", points: 32, confidence: .88, d: "M 530 300 a 22 22 0 1 0 .1 0", dxfPoints: [[530, 300], [552, 300]] },
  { id: "dimension", name: "Cota horizontal", type: "LINE", layer: "GUIDES", points: 2, confidence: .93, d: "M 90 58 H 680 M 90 48 V 68 M 680 48 V 68", dxfPoints: [[90, 58], [680, 58]] },
];

const layerColors: Record<Layer, string> = {
  CONTOURS: "#b7f34a",
  DETAILS: "#66dcff",
  GUIDES: "#ffca5c",
};

function exportDemo(kind: "svg" | "dxf") {
  const content = kind === "svg"
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 470"><g fill="none" stroke="#111" stroke-width="2">${objects.map((item) => `<path d="${item.d}"/>`).join("")}</g></svg>`
    : `0\nSECTION\n2\nENTITIES\n${objects.map((item) => `0\nLWPOLYLINE\n8\n${item.layer}\n90\n${item.dxfPoints.length}\n${item.dxfPoints.map(([x, y]) => `10\n${x}\n20\n${y}`).join("\n")}`).join("\n")}\n0\nENDSEC\n0\nEOF\n`;
  const url = URL.createObjectURL(new Blob([content], { type: kind === "svg" ? "image/svg+xml" : "application/dxf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `vectorcad-preview.${kind}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PublicTechnicalPreview3D() {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("vector");
  const [unit, setUnit] = useState<Unit>("mm");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState({ x: 58, y: -14 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showContours, setShowContours] = useState(true);
  const [showLayers, setShowLayers] = useState(true);
  const [showTexts, setShowTexts] = useState(true);
  const [showAi, setShowAi] = useState(true);
  const [selectedId, setSelectedId] = useState("north");
  const [tooltip, setTooltip] = useState<Tooltip>(null);
  const [dragging, setDragging] = useState(false);
  const interaction = useRef({ x: 0, y: 0, panX: 0, panY: 0, rotateX: 0, rotateY: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => objects.find((item) => item.id === selectedId), [selectedId]);

  function startDrag(event: React.PointerEvent<SVGSVGElement>) {
    if ((event.target as SVGElement).closest("[data-preview-object]")) return;
    setDragging(true);
    interaction.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y, rotateX: rotation.x, rotateY: rotation.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<SVGSVGElement>) {
    if (!dragging) return;
    if (event.shiftKey) {
      setPan({ x: interaction.current.panX + event.clientX - interaction.current.x, y: interaction.current.panY + event.clientY - interaction.current.y });
      return;
    }
    setRotation({ x: interaction.current.rotateX - (event.clientY - interaction.current.y) * .35, y: interaction.current.rotateY + (event.clientX - interaction.current.x) * .35 });
  }

  function wheel(event: React.WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    setZoom((value) => Math.min(2.8, Math.max(.62, value + (event.deltaY > 0 ? -.12 : .12))));
  }

  function showTooltip(event: React.MouseEvent<SVGPathElement>, item: PreviewObject) {
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setTooltip({ id: item.id, x: event.clientX - bounds.left + 12, y: event.clientY - bounds.top + 12 });
  }

  const toggles = [
    { label: "Contours", value: showContours, set: setShowContours },
    { label: "Layers", value: showLayers, set: setShowLayers },
    { label: "Textos", value: showTexts, set: setShowTexts },
    { label: "Visual AI Overlay", value: showAi, set: setShowAi },
  ];

  return (
    <section className="border-b border-[#1c2822] bg-[#050807] px-4 py-16 lg:px-8 lg:py-24" aria-labelledby="technical-preview-3d-title">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[.72fr_1.28fr] lg:gap-14">
        <div>
          <span className="inline-flex rounded-full border border-[#b7f34a]/40 bg-[#b7f34a]/10 px-4 py-2 text-xs font-black uppercase tracking-[.16em] text-[#b7f34a]">Preview Tecnico 3D</span>
          <h2 id="technical-preview-3d-title" className="mt-6 max-w-xl text-4xl font-black leading-[1.05] tracking-[-.05em] md:text-6xl">Inspecione seu desenho em uma nova dimensao.</h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#b8c8c0]">Gire a planta, explore layers, confira textos detectados e visualize a leitura da IA antes de criar sua conta.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-2xl bg-[#b7f34a] px-6 py-4 text-sm font-black text-[#07100a] shadow-[0_0_32px_rgba(183,243,74,.16)] transition hover:-translate-y-0.5 hover:brightness-105">Teste o VectorCAD AI</Link>
            <Link href="/signup" className="rounded-2xl border border-[#304238] px-6 py-4 text-sm font-black text-[#edf5f0] transition hover:-translate-y-0.5 hover:border-[#b7f34a]/60 hover:bg-[#111915]">Criar conta</Link>
          </div>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-3 text-xs text-[#8ea098]"><div><strong className="block text-lg text-[#edf5f0]">42</strong>linhas detectadas</div><div><strong className="block text-lg text-[#edf5f0]">18</strong>objetos CAD</div><div><strong className="block text-lg text-[#edf5f0]">94%</strong>confianca media</div></div>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-[#304238] bg-[#0b120e] shadow-2xl shadow-black/50">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#223028] px-4 py-3"><div className="flex items-center gap-2 text-xs font-black text-[#edf5f0]"><span className="h-2 w-2 rounded-full bg-[#b7f34a] shadow-[0_0_12px_#b7f34a]" /> Preview Tecnico 3D <span className="font-normal text-[#718279]">/ planta-demo.dxf</span></div><div className="text-[11px] font-bold text-[#8ea098]">{Math.round(zoom * 100)}% · Escala 1:{unit === "mm" ? "1" : unit === "cm" ? "0.1" : "px"}</div></div>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_210px]">
            <div className="min-w-0 border-b border-[#223028] lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-center gap-2 border-b border-[#223028] p-3">{(["original", "processed", "vector"] as DisplayMode[]).map((item) => <button key={item} type="button" onClick={() => setDisplayMode(item)} className={`rounded-lg px-3 py-2 text-[11px] font-black transition ${displayMode === item ? "bg-[#b7f34a] text-[#07100a]" : "bg-[#121b16] text-[#9eb0a7] hover:text-[#edf5f0]"}`}>{item === "original" ? "Original" : item === "processed" ? "Processada" : "Vetor"}</button>)}<button type="button" onClick={() => setUnit((value) => value === "mm" ? "cm" : value === "cm" ? "px" : "mm")} className="ml-auto rounded-lg border border-[#304238] px-3 py-2 text-[11px] font-black text-[#b7f34a] transition hover:bg-[#121b16]">Escala: {unit}</button></div>
              <div ref={viewportRef} className="relative h-[380px] overflow-hidden bg-[#060a08] sm:h-[450px] [perspective:900px]">
                <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(#142019_1px,transparent_1px),linear-gradient(90deg,#142019_1px,transparent_1px)] [background-size:24px_24px]" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#b7f34a]/10 blur-3xl" />
                <svg viewBox="0 0 760 470" className={`relative h-full w-full touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)} onWheel={wheel} onClick={() => setSelectedId("")} role="img" aria-label="Preview 3D interativo de desenho tecnico">
                  <g transform={`translate(${pan.x} ${pan.y})`} style={{ transformBox: "view-box", transformOrigin: "center", transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}>
                    <path d="M 90 92 H 680 V 372 H 90 Z" fill="#102116" stroke="#b7f34a" strokeWidth="8" opacity=".16" transform="translate(0 16)" />
                    <rect x="0" y="0" width="760" height="470" fill="#07100a" opacity={displayMode === "original" ? .82 : .25} />
                    {showContours && objects.map((item) => { const selectedObject = item.id === selectedId; const stroke = showLayers ? layerColors[item.layer] : "#b7f34a"; const opacity = displayMode === "original" ? .25 : displayMode === "processed" ? .7 : 1; return <path key={item.id} data-preview-object="true" d={item.d} fill="none" stroke={stroke} strokeWidth={selectedObject ? 4 : 2} strokeLinecap="round" opacity={opacity} className="transition-all duration-200 hover:stroke-white hover:opacity-100" onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); }} onMouseEnter={(event) => showTooltip(event, item)} onMouseMove={(event) => showTooltip(event, item)} onMouseLeave={() => setTooltip(null)} />; })}
                    {showTexts && <g fill="#f1f7f3" fontFamily="monospace" fontSize="14" fontWeight="700" opacity={displayMode === "original" ? .35 : 1}><text x="135" y="180">SALA TECNICA</text><text x="450" y="145">P-101</text><text x="470" y="350">3500 mm</text></g>}
                    {showAi && <g fill="none" stroke="#54e58b" strokeDasharray="5 4" strokeWidth="1.5"><rect x="128" y="157" width="135" height="31" rx="5" /><rect x="442" y="125" width="62" height="28" rx="5" /><rect x="462" y="330" width="87" height="28" rx="5" /></g>}
                  </g>
                </svg>
                <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-[#304238] bg-[#07100a]/90 px-3 py-2 text-[10px] font-black uppercase tracking-[.14em] text-[#b7f34a]">Arraste para girar · Shift + arraste para mover</div>
                {tooltip && <div className="pointer-events-none absolute z-10 max-w-[190px] rounded-xl border border-[#496052] bg-[#07100a]/95 p-3 text-xs shadow-xl" style={{ left: Math.min(tooltip.x, 250), top: Math.min(tooltip.y, 310) }}><strong className="block text-[#b7f34a]">{objects.find((item) => item.id === tooltip.id)?.name}</strong><span className="mt-1 block text-[#b8c8c0]">Passe o mouse para inspecionar</span></div>}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-[#223028] p-3">{toggles.map((toggle) => <button key={toggle.label} type="button" aria-pressed={toggle.value} onClick={() => toggle.set(!toggle.value)} className={`rounded-lg border px-2.5 py-2 text-[10px] font-black transition ${toggle.value ? "border-[#b7f34a]/60 bg-[#b7f34a]/10 text-[#b7f34a]" : "border-[#304238] text-[#718279] hover:text-[#edf5f0]"}`}>{toggle.label}</button>)}</div>
              <div className="grid grid-cols-2 gap-2 border-t border-[#223028] p-3 sm:grid-cols-4">{[["Linhas detectadas", "42"], ["Objetos", "18"], ["Reducao", "78%"], ["Confianca media", "94%"]].map(([label, value]) => <div key={label} className="rounded-xl bg-[#101913] px-3 py-2"><span className="block text-[9px] font-black uppercase tracking-[.12em] text-[#718279]">{label}</span><strong className="text-sm text-[#edf5f0]">{value}</strong></div>)}</div>
            </div>
            <aside className="flex flex-col bg-[#0d1510] p-4" aria-label="Propriedades do objeto selecionado"><div className="flex items-center justify-between"><h3 className="text-sm font-black text-[#edf5f0]">Propriedades</h3><span className="rounded-full bg-[#b7f34a]/10 px-2 py-1 text-[9px] font-black text-[#b7f34a]">CAD</span></div><div className="mt-4 space-y-3 text-xs"><div><span className="block text-[#718279]">Tipo</span><strong className="text-[#edf5f0]">{selected?.type ?? "Nenhum objeto"}</strong></div><div><span className="block text-[#718279]">Layer</span><strong style={{ color: selected ? layerColors[selected.layer] : "#edf5f0" }}>{selected?.layer ?? "-"}</strong></div><div><span className="block text-[#718279]">Pontos</span><strong className="text-[#edf5f0]">{selected?.points ?? "-"}</strong></div><div><span className="block text-[#718279]">Confianca</span><strong className="text-[#edf5f0]">{selected ? `${Math.round(selected.confidence * 100)}%` : "-"}</strong></div></div><div className="mt-auto space-y-2 pt-8"><button type="button" onClick={() => exportDemo("svg")} className="w-full rounded-xl bg-[#b7f34a] px-3 py-2.5 text-xs font-black text-[#07100a] transition hover:brightness-105">Exportar SVG</button><button type="button" onClick={() => exportDemo("dxf")} className="w-full rounded-xl border border-[#496052] px-3 py-2.5 text-xs font-black text-[#edf5f0] transition hover:border-[#b7f34a] hover:text-[#b7f34a]">Exportar DXF</button></div></aside>
          </div>
        </div>
      </div>
    </section>
  );
}

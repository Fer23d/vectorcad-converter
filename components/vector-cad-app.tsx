"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, ChevronDown, Crosshair, Download, FileImage, Layers3, Maximize2, MousePointer2, RotateCcw, ScanLine, Settings2, Sparkles, Upload, WandSparkles, ZoomIn, ZoomOut } from "lucide-react";
import { useResizablePanel } from "@/components/hooks/use-resizable-panel";
import { useZoomPan } from "@/components/hooks/use-zoom-pan";
import { SvgToCad3DViewer } from "@/components/svg-to-cad-3d-viewer";
import { processPixels } from "@/lib/image-processing/process";
import { scaleDocument, vectorizeBitmap } from "@/lib/vectorize/contours";
import { generateSvg } from "@/lib/exporters/svg";
import { countDxfEntities, generateDxf } from "@/lib/exporters/dxf";
import type { OutputMode, ProcessingSettings, Unit, VectorDocument, VectorMode, VectorSettings } from "@/types/vector";

const MAX_FILE = 12 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const defaultProcessing: ProcessingSettings = { brightness: 0, contrast: 125, threshold: 160, adaptiveThreshold: false, blurRadius: 1, morphologyRadius: 1, openingRadius: 0, minComponentArea: 8, invert: false, removeNoise: true, smooth: true, edgeDetect: false };
const defaultVector: VectorSettings = { mode: "logo", outputMode: "smooth", simplification: 1.8, minArea: 12, smoothIterations: 1, closePaths: true, joinDistance: 2 };
const presets: Record<string, { processing: Partial<ProcessingSettings>; vector: Partial<VectorSettings> }> = {
  fidelity: { processing: { blurRadius: 0, morphologyRadius: 0, openingRadius: 0, minComponentArea: 2 }, vector: { outputMode: "pixel", simplification: .35, smoothIterations: 0, joinDistance: 1 } },
  cnc: { processing: { blurRadius: 1, morphologyRadius: 2, openingRadius: 0, minComponentArea: 20 }, vector: { outputMode: "cad", simplification: 2.5, smoothIterations: 1, joinDistance: 4, closePaths: true } },
  logo: { processing: { blurRadius: 2, morphologyRadius: 1, openingRadius: 1, minComponentArea: 12 }, vector: { outputMode: "smooth", simplification: 1.8, smoothIterations: 2, joinDistance: 3 } },
};

function Slider({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return <label className="range-row text-xs text-[#aab8b1]"><span>{label}</span><b className="text-right text-[#e8efeb]">{value}</b><input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} /></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-[#bdc9c3]"><span>{label}</span><button type="button" aria-pressed={checked} onClick={() => onChange(!checked)} className={`h-5 w-9 rounded-full p-0.5 transition ${checked ? "bg-[#b7f34a]" : "bg-[#39443f]"}`}><span className={`block h-4 w-4 rounded-full bg-[#07100a] transition ${checked ? "translate-x-4" : ""}`} /></button></label>;
}

function download(name: string, body: string, type: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

export function VectorCadApp() {
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [processing, setProcessing] = useState(defaultProcessing);
  const [vector, setVector] = useState(defaultVector);
  const [doc, setDoc] = useState<VectorDocument | null>(null);
  const [unit, setUnit] = useState<Unit>("mm");
  const [realWidth, setRealWidth] = useState(100);
  const [realHeight, setRealHeight] = useState(100);
  const [locked, setLocked] = useState(true);
  const [activeView, setActiveView] = useState<"original" | "processed" | "vector">("vector");
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("Envie uma imagem para começar.");
  const [show3d, setShow3d] = useState(false);
  const originalCanvas = useRef<HTMLCanvasElement>(null), processedCanvas = useRef<HTMLCanvasElement>(null);
  const previewViewport = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const maxControlsWidth = useCallback(() => Math.max(260, window.innerWidth - 300 - 270 - 8), []);
  const panel = useResizablePanel({ initialSize: 280, minSize: 260, maxSize: maxControlsWidth, storageKey: "vectorcad-controls-width" });
  const viewer = useZoomPan("vectorcad-preview-zoom");

  const loadFile = useCallback((file?: File) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) return setMessage("Formato inválido. Envie PNG, JPG, JPEG ou WEBP.");
    if (file.size > MAX_FILE) return setMessage("O arquivo excede o limite de 12 MB.");
    const url = URL.createObjectURL(file), image = new Image();
    image.onload = () => { setSource(image); setFileName(file.name); setRealHeight(Number((100 * image.height / image.width).toFixed(2))); setMessage("Imagem carregada. Ajuste o limiar para refinar os contornos."); URL.revokeObjectURL(url); };
    image.onerror = () => setMessage("Não foi possível processar essa imagem. Tente outro arquivo.");
    image.src = url;
  }, []);

  useEffect(() => {
    if (!source) return;
    const max = 720, scale = Math.min(1, max / Math.max(source.width, source.height));
    const w = Math.max(1, Math.round(source.width * scale)), h = Math.max(1, Math.round(source.height * scale));
    const oc = originalCanvas.current!, pc = processedCanvas.current!;
    oc.width = pc.width = w; oc.height = pc.height = h;
    const ctx = oc.getContext("2d", { willReadFrequently: true })!;
    ctx.clearRect(0, 0, w, h); ctx.drawImage(source, 0, 0, w, h);
    const result = processPixels(ctx.getImageData(0, 0, w, h), processing);
    pc.getContext("2d")!.putImageData(result.image, 0, 0);
    setDoc(vectorizeBitmap(result.bitmap, w, h, vector));
    if (result.darkRatio > .55) setMessage("Foram detectadas muitas áreas escuras. Tente ajustar o threshold ou inverter as cores.");
    else if (result.darkRatio < .003) setMessage("A imagem tem pouco contraste. Tente aumentar o threshold.");
  }, [source, processing, vector]);

  const finalDoc = doc ? scaleDocument(doc, realWidth, realHeight, unit) : null;
  const svg = finalDoc ? generateSvg(finalDoc) : "";
  const updateWidth = (v: number) => { setRealWidth(v); if (locked && source) setRealHeight(Number((v * source.height / source.width).toFixed(2))); };
  const updateHeight = (v: number) => { setRealHeight(v); if (locked && source) setRealWidth(Number((v * source.width / source.height).toFixed(2))); };
  const exportFile = (kind: "svg" | "dxf") => {
    if (!finalDoc) return setMessage("Envie e vetorize uma imagem antes de exportar.");
    if (kind === "dxf" && countDxfEntities(finalDoc) === 0) return setMessage("Nenhum contorno CAD válido foi detectado. Ajuste o threshold ou reduza o fragmento mínimo.");
    download(`${fileName.replace(/\.[^.]+$/, "") || "vectorcad"}.${kind}`, kind === "svg" ? svg : generateDxf(finalDoc), kind === "svg" ? "image/svg+xml" : "application/dxf");
    setMessage(kind === "dxf" ? "DXF gerado com enquadramento automático. Ao abrir no CAD, o desenho deve aparecer imediatamente." : "Arquivo SVG gerado com sucesso.");
  };
  const exportPng = () => {
    const c = processedCanvas.current; if (!c) return;
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "vectorcad-preview.png"; a.click();
  };
  const generate3d = () => {
    if (!finalDoc || !svg) return setMessage("Vetorize uma imagem antes de gerar o modelo 3D.");
    setShow3d(true);
    setMessage("Modelo 3D CAD pronto para preview. Ajuste a altura e exporte STL ou GLB.");
  };
  const pathCount = doc?.paths.length || 0, pointCount = doc?.paths.reduce((n, p) => n + p.points.length, 0) || 0;

  return <main className="min-h-screen bg-[radial-gradient(circle_at_50%_-20%,#1d3428_0,#080c0b_42%)]">
    <header className="flex h-16 items-center justify-between border-b border-[#26312c] px-4 md:px-7">
      <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#b7f34a] text-[#09120d]"><Box size={20} /></div><div><div className="text-sm font-black tracking-[.16em]">VECTORCAD</div><div className="text-[9px] tracking-[.28em] text-[#7e9187]">CONVERTER</div></div></div>
      <div className="hidden items-center gap-2 text-xs text-[#91a097] md:flex"><span className="h-2 w-2 rounded-full bg-[#b7f34a]" /> Motor vetorial pronto</div>
      <button onClick={() => input.current?.click()} className="flex items-center gap-2 rounded-lg border border-[#3c4b44] px-3 py-2 text-xs font-bold hover:bg-[#18201c]"><Upload size={14} /> Nova imagem</button>
    </header>

    {!source && <section className="mx-auto max-w-6xl px-5 pb-20 pt-16 text-center md:pt-24">
      <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-[#3d513e] bg-[#162219] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-[#b7f34a]"><Sparkles size={12} /> Raster para CAD editável</div>
      <h1 className="mx-auto max-w-3xl text-4xl font-black tracking-[-.045em] text-white md:text-6xl">Transforme imagens em <span className="text-[#b7f34a]">vetores para CAD</span></h1>
      <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#9faca6] md:text-base">Converta PNG e JPG em SVG e DXF editável para AutoCAD, corte laser, CNC e projetos técnicos.</p>
      <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }} onClick={() => input.current?.click()} className={`mx-auto mt-10 max-w-3xl cursor-pointer rounded-2xl border border-dashed p-12 transition md:p-16 ${dragging ? "border-[#b7f34a] bg-[#17251a]" : "border-[#425148] bg-[#111714]/80 hover:border-[#829b83]"}`}>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#b7f34a] text-[#08110b]"><Upload size={26} /></div><h2 className="mt-5 text-lg font-bold">Arraste sua imagem para cá</h2><p className="mt-2 text-xs text-[#829087]">PNG, JPG, JPEG ou WEBP · Máximo 12 MB</p><button className="mt-6 rounded-lg bg-white px-5 py-2.5 text-xs font-black text-[#101512]">Enviar imagem</button>
      </div>
      <div className="mx-auto mt-8 grid max-w-3xl grid-cols-3 gap-3 text-left"><Feature icon={<ScanLine />} title="Contornos reais" text="Polilinhas editáveis" /><Feature icon={<Crosshair />} title="Escala precisa" text="mm, cm ou pixels" /><Feature icon={<Layers3 />} title="Layers CAD" text="Contours e Details" /></div>
    </section>}

    {source && <section className="workspace-layout min-h-[calc(100vh-64px)]" style={{ "--controls-width": `${panel.size}px` } as React.CSSProperties}>
      <aside className="controls-panel border-r border-[#26312c] bg-[#0d1210] p-4">
        <Section title="Pré-processamento" icon={<WandSparkles size={14} />}>
          <Slider label="Brilho" value={processing.brightness} min={-100} max={100} onChange={v => setProcessing({ ...processing, brightness: v })} />
          <Slider label="Contraste" value={processing.contrast} min={20} max={250} onChange={v => setProcessing({ ...processing, contrast: v })} />
          <Slider label="Threshold" value={processing.threshold} min={1} max={254} onChange={v => setProcessing({ ...processing, threshold: v })} />
          <Slider label="Suavização da imagem" value={processing.blurRadius} min={0} max={3} onChange={v => setProcessing({ ...processing, blurRadius: v, smooth: v > 0 })} />
          <Slider label="Fechar falhas / gaps" value={processing.morphologyRadius} min={0} max={3} onChange={v => setProcessing({ ...processing, morphologyRadius: v })} />
          <Slider label="Opening / limpar manchas" value={processing.openingRadius} min={0} max={2} onChange={v => setProcessing({ ...processing, openingRadius: v })} />
          <Slider label="Ruído mínimo" value={processing.minComponentArea} min={0} max={100} onChange={v => setProcessing({ ...processing, minComponentArea: v })} />
          <Toggle label="Threshold adaptativo" checked={processing.adaptiveThreshold} onChange={v => setProcessing({ ...processing, adaptiveThreshold: v })} />
          <Toggle label="Remover ruído" checked={processing.removeNoise} onChange={v => setProcessing({ ...processing, removeNoise: v })} />
          <Toggle label="Detectar linhas internas" checked={processing.edgeDetect} onChange={v => setProcessing({ ...processing, edgeDetect: v })} />
          <Toggle label="Inverter cores" checked={processing.invert} onChange={v => setProcessing({ ...processing, invert: v })} />
        </Section>
        <Section title="Vetorização" icon={<ScanLine size={14} />}>
          <label className="text-[10px] uppercase tracking-wider text-[#77867e]">Modo de saída</label>
          <div className="grid grid-cols-3 gap-1">{([["pixel", "Fiel"], ["smooth", "Suave"], ["cad", "CAD limpo"]] as [OutputMode, string][]).map(([value, label]) => <button key={value} onClick={() => setVector({ ...vector, outputMode: value })} className={`rounded-md px-1 py-2 text-[9px] font-bold ${vector.outputMode === value ? "bg-[#b7f34a] text-[#0c150e]" : "bg-[#18201c] text-[#8f9d95]"}`}>{label}</button>)}</div>
          <label className="text-[10px] uppercase tracking-wider text-[#77867e]">Modo</label>
          <select value={vector.mode} onChange={e => setVector({ ...vector, mode: e.target.value as VectorMode })} className="w-full text-xs"><option value="logo">Logo</option><option value="technical">Desenho técnico</option><option value="silhouette">Silhueta</option><option value="outline">Contorno externo</option><option value="precision">Alta precisão</option><option value="cnc">CNC / corte laser</option></select>
          <Slider label="Simplificação" value={vector.simplification} min={0} max={8} step={.1} onChange={v => setVector({ ...vector, simplification: v })} />
          <Slider label="Fragmento mínimo" value={vector.minArea} min={0} max={500} onChange={v => setVector({ ...vector, minArea: v })} />
          <Slider label="Unir pontas próximas" value={vector.joinDistance} min={0} max={12} step={.5} onChange={v => setVector({ ...vector, joinDistance: v })} />
          <Slider label="Suavização do vetor" value={vector.smoothIterations} min={0} max={3} onChange={v => setVector({ ...vector, smoothIterations: v })} />
          <Toggle label="Fechar contornos" checked={vector.closePaths} onChange={v => setVector({ ...vector, closePaths: v })} />
        </Section>
        <Section title="Presets" icon={<Sparkles size={14} />}>
          <div className="grid grid-cols-3 gap-1">{([["fidelity", "Fidelidade"], ["cnc", "Corte/CNC"], ["logo", "Logo"]] as const).map(([value, label]) => <button key={value} onClick={() => { setProcessing(current => ({ ...current, ...presets[value].processing })); setVector(current => ({ ...current, ...presets[value].vector })); }} className="rounded-md bg-[#18201c] px-1 py-2 text-[9px] font-bold text-[#b9c5bf] hover:bg-[#29372f]">{label}</button>)}</div>
        </Section>
        <button onClick={() => { setProcessing(defaultProcessing); setVector(defaultVector); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#34413b] py-2 text-xs text-[#a7b3ad]"><RotateCcw size={13} /> Restaurar ajustes</button>
      </aside>
      <button type="button" aria-label="Redimensionar painel de controles" title="Arraste para redimensionar" onPointerDown={panel.startResize} className={`panel-resizer ${panel.resizing ? "is-resizing" : ""}`}><span /></button>

      <div className="preview-panel flex min-h-[600px] min-w-0 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#26312c] bg-[#0d1210] px-4 py-3">
          <div className="flex gap-1 rounded-lg bg-[#151c19] p-1">{(["original", "processed", "vector"] as const).map(v => <button key={v} onClick={() => setActiveView(v)} className={`rounded-md px-3 py-1.5 text-[10px] font-bold uppercase ${activeView === v ? "bg-[#334039] text-white" : "text-[#7f8e86]"}`}>{v === "original" ? "Original" : v === "processed" ? "Processada" : "Vetor"}</button>)}</div>
          <div className="flex items-center gap-2"><button title="Diminuir zoom" onClick={viewer.zoomOut} className="rounded border border-[#34413b] p-1.5"><ZoomOut size={14} /></button><span className="w-11 text-center text-[10px]">{Math.round(viewer.zoom * 100)}%</span><button title="Aumentar zoom" onClick={viewer.zoomIn} className="rounded border border-[#34413b] p-1.5"><ZoomIn size={14} /></button><button title="Ajustar à tela" onClick={() => viewer.fit(previewViewport.current, doc?.sourceWidth || 0, doc?.sourceHeight || 0)} className="flex items-center gap-1 rounded border border-[#34413b] px-2 py-1.5 text-[9px]"><Maximize2 size={13} /> Ajustar</button><button title="Zoom 100%" onClick={viewer.reset} className="rounded border border-[#34413b] px-2 py-1.5 text-[9px]">100%</button></div>
        </div>
        <div ref={previewViewport} onPointerDown={viewer.onPointerDown} onPointerMove={viewer.onPointerMove} onPointerUp={viewer.onPointerUp} onPointerCancel={viewer.onPointerCancel} onWheel={viewer.onWheel} className={`checker preview-viewport relative flex flex-1 items-center justify-center overflow-hidden p-6 ${viewer.zoom > 1 ? viewer.panning ? "cursor-grabbing" : "cursor-grab" : "cursor-default"}`}>
          <div style={{ transform: `translate(${viewer.pan.x}px, ${viewer.pan.y}px) scale(${viewer.zoom})`, transformOrigin: "center", width: `${doc?.sourceWidth || 1}px`, height: `${doc?.sourceHeight || 1}px` }} className="preview-content relative shrink-0 overflow-hidden bg-white shadow-2xl">
            <canvas ref={originalCanvas} className={`${activeView === "original" ? "block" : "hidden"} h-full w-full`} />
            <canvas ref={processedCanvas} className={`${activeView === "processed" ? "block" : "hidden"} h-full w-full`} />
            {activeView === "vector" && <div className="h-full w-full bg-white" dangerouslySetInnerHTML={{ __html: svg }} />}
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-[#26312c] bg-[#101613] px-4 py-2 text-[10px] text-[#93a098]"><MousePointer2 size={12} /><span className="truncate">{message}</span><span className="ml-auto shrink-0 text-[#b7f34a]">{pathCount} caminhos · {pointCount} pontos</span></div>
      </div>

      <aside className="cad-panel border-l border-[#26312c] bg-[#0d1210] p-4">
        <Section title="Configurações CAD" icon={<Settings2 size={14} />}>
          <label className="text-[10px] uppercase tracking-wider text-[#77867e]">Unidade de saída</label><div className="grid grid-cols-3 gap-1">{(["mm", "cm", "px"] as Unit[]).map(u => <button key={u} onClick={() => setUnit(u)} className={`rounded-md py-2 text-xs font-bold ${unit === u ? "bg-[#b7f34a] text-[#0c150e]" : "bg-[#18201c] text-[#8f9d95]"}`}>{u}</button>)}</div>
          <div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-[#8d9a93]">Largura<input className="mt-1 w-full" type="number" min="0.1" value={realWidth} onChange={e => updateWidth(+e.target.value)} /></label><label className="text-[10px] text-[#8d9a93]">Altura<input className="mt-1 w-full" type="number" min="0.1" value={realHeight} onChange={e => updateHeight(+e.target.value)} /></label></div>
          <Toggle label="Manter proporção" checked={locked} onChange={setLocked} />
        </Section>
        <Section title="Resumo do vetor" icon={<Layers3 size={14} />}><Stat label="Caminhos" value={pathCount} /><Stat label="Pontos editáveis" value={pointCount} /><Stat label="Layer principal" value="CONTOURS" /><Stat label="Dimensão" value={`${realWidth} × ${realHeight} ${unit}`} /></Section>
        <div className="mt-5 rounded-xl border border-[#38483f] bg-[#151e19] p-3 text-[10px] leading-5 text-[#aab7b0]"><b className="text-[#b7f34a]">Contornos contínuos</b><br />O DXF usa LWPOLYLINEs editáveis, suavizadas e organizadas em layers.</div>
        <div className="mt-5 grid gap-2"><button onClick={() => exportFile("dxf")} className="flex items-center justify-center gap-2 rounded-lg bg-[#b7f34a] py-3 text-xs font-black text-[#0a120c]"><Download size={15} /> Exportar DXF</button><button onClick={() => exportFile("svg")} className="flex items-center justify-center gap-2 rounded-lg bg-white py-3 text-xs font-black text-[#111713]"><Download size={15} /> Exportar SVG</button><button onClick={exportPng} className="flex items-center justify-center gap-2 rounded-lg border border-[#3c4943] py-2.5 text-xs font-bold"><FileImage size={14} /> PNG preview</button><button onClick={generate3d} className="flex items-center justify-center gap-2 rounded-lg border border-[#b7f34a]/60 bg-[#182019] py-2.5 text-xs font-black text-[#b7f34a]"><Box size={14} /> Gerar modelo 3D</button></div>
        {show3d && <div className="mt-5"><SvgToCad3DViewer svg={svg} fileName={fileName} unit={unit} /></div>}
      </aside>
    </section>}
    <input ref={input} type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={e => loadFile(e.target.files?.[0])} />
  </main>;
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="mb-5 border-b border-[#26312c] pb-5"><h3 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[#e7eee9]">{icon}{title}<ChevronDown size={12} className="ml-auto text-[#74847b]" /></h3><div className="grid gap-4">{children}</div></section>; }
function Stat({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex items-center justify-between text-[10px] text-[#829189]"><span>{label}</span><b className="text-[#dce6e0]">{value}</b></div>; }
function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="panel rounded-xl p-3 md:p-4"><div className="text-[#b7f34a] [&>svg]:h-4 [&>svg]:w-4">{icon}</div><div className="mt-3 text-xs font-bold">{title}</div><div className="mt-1 text-[10px] text-[#7f8d85]">{text}</div></div>; }

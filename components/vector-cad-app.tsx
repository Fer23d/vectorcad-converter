"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, ChevronDown, Crosshair, Download, ExternalLink, FileImage, Layers3, Maximize2, MousePointer2, RotateCcw, ScanLine, Settings2, Sparkles, Upload, WandSparkles, ZoomIn, ZoomOut } from "lucide-react";
import { useResizablePanel } from "@/components/hooks/use-resizable-panel";
import { useZoomPan } from "@/components/hooks/use-zoom-pan";
import { useLocalProjectDraft } from "@/components/hooks/use-local-project-draft";
import { SvgTo3DCadViewer } from "@/components/SvgTo3DCadViewer";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { enhanceForCad, processPixels } from "@/lib/image-processing/process";
import { decodeTiffDataUrl, isTiffFile, processTiff, type TiffRaster } from "@/lib/image-processing/tiff";
import { scaleDocument, vectorizeBitmap } from "@/lib/vectorize/contours";
import { generateSvg } from "@/lib/exporters/svg";
import { countDxfEntities, generateDxf } from "@/lib/exporters/dxf";
import type { ImageQuality, OutputMode, ProcessingSettings, Unit, VectorDocument, VectorMode, VectorSettings } from "@/types/vector";
import type { CadProjectData } from "@/types/project";

const MAX_FILE = 12 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/tiff", "image/x-tiff"];
const CONTROLS_MIN_WIDTH = 260;
const CAD_MIN_WIDTH = 260;
const PREVIEW_MIN_WIDTH = 300;
const RESIZER_TOTAL_WIDTH = 16;
const defaultProcessing: ProcessingSettings = { brightness: 0, contrast: 125, threshold: 160, adaptiveThreshold: false, blurRadius: 1, morphologyRadius: 1, openingRadius: 0, minComponentArea: 8, invert: false, removeNoise: true, smooth: true, edgeDetect: false };
const defaultVector: VectorSettings = { mode: "logo", outputMode: "smooth", simplification: 1.8, minArea: 12, smoothIterations: 1, closePaths: true, joinDistance: 2 };
const presets: Record<string, { processing: Partial<ProcessingSettings>; vector: Partial<VectorSettings> }> = {
  fidelity: { processing: { blurRadius: 0, morphologyRadius: 0, openingRadius: 0, minComponentArea: 2 }, vector: { outputMode: "pixel", simplification: .35, smoothIterations: 0, joinDistance: 1 } },
  cnc: { processing: { blurRadius: 1, morphologyRadius: 2, openingRadius: 0, minComponentArea: 20 }, vector: { outputMode: "cad", simplification: 2.5, smoothIterations: 1, joinDistance: 4, closePaths: true } },
  logo: { processing: { blurRadius: 2, morphologyRadius: 1, openingRadius: 1, minComponentArea: 12 }, vector: { outputMode: "smooth", simplification: 1.8, smoothIterations: 2, joinDistance: 3 } },
};

type UsageInfo = {
  plan: string;
  usage: number;
  usageLimit: number | null;
  export3d: number;
  export3dLimit: number | null;
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

export function VectorCadApp({ onUsageChange, initialData, onProjectChange, onPrepare3dProject, projectId, userId, draftClearSignal }: { onUsageChange?: (usage: UsageInfo) => void; initialData?: CadProjectData | null; onProjectChange?: (data: CadProjectData) => void; onPrepare3dProject?: (data: CadProjectData) => Promise<string | null>; projectId?: string | null; userId?: string | null; draftClearSignal?: string }) {
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [sourceRaster, setSourceRaster] = useState<TiffRaster | null>(null);
  const [sourceFormat, setSourceFormat] = useState<"raster" | "tiff">(initialData?.sourceFormat || "raster");
  const [sourceImageDataUrl, setSourceImageDataUrl] = useState(initialData?.sourceImageDataUrl || "");
  const [sourceOriginalDataUrl, setSourceOriginalDataUrl] = useState(initialData?.sourceOriginalDataUrl || "");
  const [fileName, setFileName] = useState(initialData?.fileName || "");
  const [processing, setProcessing] = useState(initialData?.processing || defaultProcessing);
  const [imageQuality, setImageQuality] = useState<ImageQuality>(initialData?.imageQuality || "enhanced");
  const [vector, setVector] = useState(initialData?.vector || defaultVector);
  const [doc, setDoc] = useState<VectorDocument | null>(initialData?.document || null);
  const [unit, setUnit] = useState<Unit>(initialData?.unit || "mm");
  const [realWidth, setRealWidth] = useState(initialData?.realWidth || 100);
  const [realHeight, setRealHeight] = useState(initialData?.realHeight || 100);
  const [locked, setLocked] = useState(initialData?.locked ?? true);
  const [activeView, setActiveView] = useState<"original" | "processed" | "vector">(initialData?.activeView || "vector");
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("Envie uma imagem para começar.");
  const [show3d, setShow3d] = useState(initialData?.editorMode === "cad3d");
  const [show3dOptions, setShow3dOptions] = useState(false);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [upgradeModal, setUpgradeModal] = useState("");
  const hydrating = useRef(true);
  const skipLocalSave = useRef(true);
  const originalCanvas = useRef<HTMLCanvasElement>(null), processedCanvas = useRef<HTMLCanvasElement>(null);
  const previewViewport = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const controlsSize = useRef(280), cadSize = useRef(270);
  const updateControlsSize = useCallback((size: number) => { controlsSize.current = size; }, []);
  const updateCadSize = useCallback((size: number) => { cadSize.current = size; }, []);
  const maxControlsWidth = useCallback(() => Math.max(CONTROLS_MIN_WIDTH, window.innerWidth - PREVIEW_MIN_WIDTH - cadSize.current - RESIZER_TOTAL_WIDTH), []);
  const maxCadWidth = useCallback(() => Math.max(CAD_MIN_WIDTH, window.innerWidth - PREVIEW_MIN_WIDTH - controlsSize.current - RESIZER_TOTAL_WIDTH), []);
  const panel = useResizablePanel({ initialSize: 280, minSize: CONTROLS_MIN_WIDTH, maxSize: maxControlsWidth, storageKey: "vectorcad-controls-width", edge: "left", onSizeChange: updateControlsSize });
  const cadPanel = useResizablePanel({ initialSize: 270, minSize: CAD_MIN_WIDTH, maxSize: maxCadWidth, storageKey: "vectorcad-cad-width", edge: "right", onSizeChange: updateCadSize });
  const viewer = useZoomPan("vectorcad-preview-zoom");
  const { restoredDraft, localDraftDirty, saveDraft } = useLocalProjectDraft({ userId, projectId, hasInitialData: Boolean(initialData), clearSignal: draftClearSignal });

  useEffect(() => {
    const saved = (!draftClearSignal && restoredDraft?.data) || initialData;
    hydrating.current = true;
    skipLocalSave.current = true;
    const restore = () => {

    if (!saved?.sourceImageDataUrl) {
      setSource(null);
      setSourceRaster(null);
      setSourceFormat("raster");
      setSourceImageDataUrl(saved?.sourceImageDataUrl || "");
      setSourceOriginalDataUrl(saved?.sourceOriginalDataUrl || "");
      setFileName(saved?.fileName || "");
      setProcessing(saved?.processing || defaultProcessing);
      setImageQuality(saved?.imageQuality || "enhanced");
      setVector(saved?.vector || defaultVector);
      setDoc(saved?.document || null);
      setUnit(saved?.unit || "mm");
      setRealWidth(saved?.realWidth || 100);
      setRealHeight(saved?.realHeight || 100);
      setLocked(saved?.locked ?? true);
      setActiveView(saved?.activeView || "vector");
      setShow3d(saved?.editorMode === "cad3d");
      hydrating.current = false;
      return;
    }

    setSourceImageDataUrl(saved.sourceImageDataUrl);
    setSourceOriginalDataUrl(saved.sourceOriginalDataUrl || "");
    setSourceFormat(saved.sourceFormat || "raster");
    setSourceRaster(null);
    setFileName(saved.fileName || "");
    setProcessing(saved.processing || defaultProcessing);
    setImageQuality(saved.imageQuality || "enhanced");
    setVector(saved.vector || defaultVector);
    setDoc(saved.document || null);
    setUnit(saved.unit || "mm");
    setRealWidth(saved.realWidth || 100);
    setRealHeight(saved.realHeight || 100);
    setLocked(saved.locked ?? true);
    setActiveView(saved.activeView || "vector");
    setShow3d(saved.editorMode === "cad3d");

    if (saved.sourceFormat === "tiff" && !saved.sourceOriginalDataUrl) return;

    const image = new Image();
    image.onload = () => {
      setSourceRaster(null);
      setSource(image);
      skipLocalSave.current = true;
      hydrating.current = false;
      setMessage("Projeto carregado. Você pode continuar a edição.");
    };
    image.onerror = () => {
      hydrating.current = false;
      setMessage("O projeto foi carregado, mas a imagem original não pôde ser restaurada.");
    };
    image.src = saved.sourceImageDataUrl;
    };
    const restoreTimer = window.setTimeout(restore, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [draftClearSignal, initialData, restoredDraft]);

  useEffect(() => {
    const saved = (!draftClearSignal && restoredDraft?.data) || initialData;
    if (!saved?.sourceImageDataUrl || saved.sourceFormat !== "tiff" || saved.sourceOriginalDataUrl) return;
    let cancelled = false;
    void decodeTiffDataUrl(saved.sourceImageDataUrl).then((raster) => {
      if (cancelled) return;
      setSource(null);
      setSourceRaster(raster);
      setSourceFormat("tiff");
      hydrating.current = false;
      setMessage("TIFF carregado nativamente. VocÃª pode continuar a ediÃ§Ã£o.");
    }).catch(() => {
      if (!cancelled) {
        hydrating.current = false;
        setMessage("O arquivo TIFF foi salvo, mas nÃ£o pÃ´de ser restaurado.");
      }
    });
    return () => { cancelled = true; };
  }, [draftClearSignal, initialData, restoredDraft]);

  useEffect(() => {
    if (hydrating.current) return;
    const data: CadProjectData = {
      notes: "",
      editorMode: show3d ? "cad3d" : "cad2d",
      schemaVersion: 1,
      sourceImageDataUrl,
      sourceOriginalDataUrl: sourceFormat === "tiff" ? sourceOriginalDataUrl : undefined,
      sourceFormat,
      fileName,
      processing,
      imageQuality,
      vector,
      document: doc,
      unit,
      realWidth,
      realHeight,
      locked,
      activeView,
    };
    if (skipLocalSave.current) {
      skipLocalSave.current = false;
      onProjectChange?.(data);
      return;
    }
    saveDraft(data);
    if (onProjectChange) onProjectChange(data);
  }, [activeView, doc, fileName, imageQuality, locked, onProjectChange, processing, realHeight, realWidth, saveDraft, show3d, sourceFormat, sourceImageDataUrl, sourceOriginalDataUrl, unit, vector]);

  useEffect(() => {
    if (!localDraftDirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "Você tem alterações não salvas.";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [localDraftDirty]);

  const consumeUsage = useCallback(async (action: "vectorize" | "export_svg" | "export_png" | "export3d" | "export_dxf") => {
    if (!isSupabaseConfigured || !supabase) return true;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setMessage("Faça login para usar o VectorCAD.");
      return false;
    }

    const response = await fetch("/api/usage/consume", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(payload.error || "Não foi possível validar seu plano.");
      if (response.status === 402) setUpgradeModal(payload.error || "Você atingiu o limite diário de 3 usos. Faça upgrade para continuar.");
      return false;
    }

    setUsageInfo(payload);
    onUsageChange?.(payload);
    return true;
  }, [onUsageChange]);

  const loadFile = useCallback(async (file?: File) => {
    if (file && isTiffFile(file)) {
      if (!file || file.size > MAX_FILE) return setMessage("O arquivo excede o limite de 12 MB.");
      const allowed = await consumeUsage("vectorize");
      if (!allowed) return;
      try {
        setMessage("Convertendo TIFF para um formato processável...");
        const processedTiff = await processTiff(await file.arrayBuffer());
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("TIFF_FILE_READ_FAILED"));
          reader.readAsDataURL(file);
        });
        const pngDataUrl = processedTiff.previewPng;
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const preview = new Image();
          preview.onload = () => resolve(preview);
          preview.onerror = () => reject(new Error("TIFF_PNG_PREVIEW_FAILED"));
          preview.src = pngDataUrl;
        });
        setSourceImageDataUrl(pngDataUrl);
        setSourceOriginalDataUrl(dataUrl);
        setSourceFormat("tiff");
        setSourceRaster(null);
        setSource(image);
        setFileName(file.name);
        setRealHeight(Number((100 * processedTiff.height / processedTiff.width).toFixed(2)));
        setMessage("TIFF convertido para PNG de alta qualidade. Ajuste o limiar para refinar os contornos.");
        return;
      } catch (error) {
        setMessage(error instanceof Error && error.message === "TIFF_BIGTIFF_UNSUPPORTED"
          ? "Este arquivo BigTIFF ainda não é suportado. Envie um TIFF padrão ou converta-o para PNG."
          : "Não foi possível processar este arquivo TIFF.");
      }
      return;
    }
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) return setMessage("Formato inválido. Envie PNG, JPG, JPEG, WEBP, TIF ou TIFF.");
    if (file.size > MAX_FILE) return setMessage("O arquivo excede o limite de 12 MB.");
    const allowed = await consumeUsage("vectorize");
    if (!allowed) return;
    const url = URL.createObjectURL(file), image = new Image();
    image.onload = () => {
      const reader = new FileReader();
      reader.onload = () => setSourceImageDataUrl(String(reader.result || ""));
      reader.readAsDataURL(file!);
      setSourceFormat("raster"); setSourceOriginalDataUrl(""); setSourceRaster(null);
      setSource(image); setFileName(file.name); setRealHeight(Number((100 * image.height / image.width).toFixed(2))); setMessage("Imagem carregada. Ajuste o limiar para refinar os contornos."); URL.revokeObjectURL(url);
    };
    image.onerror = () => setMessage("Não foi possível processar essa imagem. Tente outro arquivo.");
    image.src = url;
  }, [consumeUsage]);

  useEffect(() => {
    if (!source && !sourceRaster) return;
    const sourceWidth = sourceRaster?.width || source?.width || 0;
    const sourceHeight = sourceRaster?.height || source?.height || 0;
    const max = 720, scale = Math.min(1, max / Math.max(sourceWidth, sourceHeight));
    const w = Math.max(1, Math.round(sourceWidth * scale)), h = Math.max(1, Math.round(sourceHeight * scale));
    const oc = originalCanvas.current!, pc = processedCanvas.current!;
    oc.width = pc.width = w; oc.height = pc.height = h;
    const ctx = oc.getContext("2d", { willReadFrequently: true })!;
    ctx.clearRect(0, 0, w, h);
    if (sourceRaster) {
      const rasterCanvas = document.createElement("canvas");
      rasterCanvas.width = sourceRaster.width;
      rasterCanvas.height = sourceRaster.height;
      const rasterContext = rasterCanvas.getContext("2d")!;
      const rasterImage = rasterContext.createImageData(sourceRaster.width, sourceRaster.height);
      rasterImage.data.set(sourceRaster.data);
      rasterContext.putImageData(rasterImage, 0, 0);
      ctx.drawImage(rasterCanvas, 0, 0, w, h);
    } else if (source) {
      ctx.drawImage(source, 0, 0, w, h);
    }
    const enhanced = enhanceForCad(ctx.getImageData(0, 0, w, h), imageQuality);
    const result = processPixels(enhanced, processing);
    pc.getContext("2d")!.putImageData(result.image, 0, 0);
    setDoc(vectorizeBitmap(result.bitmap, w, h, vector));
    if (result.darkRatio > .55) setMessage("Foram detectadas muitas áreas escuras. Tente ajustar o threshold ou inverter as cores.");
    else if (result.darkRatio < .003) setMessage("A imagem tem pouco contraste. Tente aumentar o threshold.");
  }, [imageQuality, processing, source, sourceRaster, vector]);

  const finalDoc = doc ? scaleDocument(doc, realWidth, realHeight, unit) : null;
  const svg = finalDoc ? generateSvg(finalDoc) : "";
  const sourceWidth = sourceRaster?.width || source?.width || 0;
  const sourceHeight = sourceRaster?.height || source?.height || 0;
  const hasSource = Boolean(source || sourceRaster);
  const updateWidth = (v: number) => { setRealWidth(v); if (locked && sourceWidth && sourceHeight) setRealHeight(Number((v * sourceHeight / sourceWidth).toFixed(2))); };
  const updateHeight = (v: number) => { setRealHeight(v); if (locked && sourceWidth && sourceHeight) setRealWidth(Number((v * sourceWidth / sourceHeight).toFixed(2))); };
  const exportFile = async (kind: "svg" | "dxf") => {
    if (!finalDoc) return setMessage("Envie e vetorize uma imagem antes de exportar.");
    if (kind === "dxf") {
      const allowed = await consumeUsage("export_dxf");
      if (!allowed) return;
    } else {
      const allowed = await consumeUsage("export_svg");
      if (!allowed) return;
    }
    if (kind === "dxf" && countDxfEntities(finalDoc) === 0) return setMessage("Nenhum contorno CAD válido foi detectado. Ajuste o threshold ou reduza o fragmento mínimo.");
    download(`${fileName.replace(/\.[^.]+$/, "") || "vectorcad"}.${kind}`, kind === "svg" ? svg : generateDxf(finalDoc), kind === "svg" ? "image/svg+xml" : "application/dxf");
    setMessage(kind === "dxf" ? "DXF gerado com enquadramento automático. Ao abrir no CAD, o desenho deve aparecer imediatamente." : "Arquivo SVG gerado com sucesso.");
  };
  const exportPng = async () => {
    const c = processedCanvas.current; if (!c) return;
    const allowed = await consumeUsage("export_png");
    if (!allowed) return;
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "vectorcad-preview.png"; a.click();
  };
  const generate3d = async () => {
    if (!finalDoc || !svg) return setMessage("Vetorize uma imagem antes de gerar o modelo 3D.");
    const allowed = await consumeUsage("export3d");
    if (!allowed) return;
    setShow3d(true);
    setMessage("Modelo 3D CAD pronto para preview. Ajuste a altura e exporte STL ou GLB.");
  };
  const open3dInNewTab = async () => {
    if (!finalDoc || !svg) {
      setMessage("Vetorize uma imagem antes de abrir o visualizador 3D.");
      return;
    }

    // Open synchronously so browsers do not treat the awaited save as a popup.
    const newTab = window.open("about:blank", "_blank", "noopener,noreferrer");
    if (!newTab) {
      setMessage("O navegador bloqueou a nova guia. Permita pop-ups para o VectorCAD.");
      return;
    }

    const data: CadProjectData = {
      notes: "",
      editorMode: "cad3d",
      schemaVersion: 1,
      sourceImageDataUrl,
      fileName,
      processing,
      imageQuality,
      vector,
      document: doc,
      unit,
      realWidth,
      realHeight,
      locked,
      activeView,
    };
    const savedProjectId = projectId || await onPrepare3dProject?.(data);
    if (!savedProjectId) {
      newTab.close();
      setMessage("Salve o projeto antes de abrir o visualizador em nova guia.");
      return;
    }

    const viewerUrl = `/projetos/${encodeURIComponent(savedProjectId)}/3d`;
    console.info("[VectorCAD][3D] opening new tab", { pathname: viewerUrl, hasProjectId: Boolean(savedProjectId) });
    newTab.location.replace(viewerUrl);
    setShow3dOptions(false);
  };
  const pathCount = doc?.paths.length || 0, pointCount = doc?.paths.reduce((n, p) => n + p.points.length, 0) || 0;

  return <main className="min-h-screen bg-[radial-gradient(circle_at_50%_-20%,#1d3428_0,#080c0b_42%)]">
    <header className="flex h-16 items-center justify-between border-b border-[#26312c] px-4 md:px-7">
      <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#b7f34a] text-[#09120d]"><Box size={20} /></div><div><div className="text-sm font-black tracking-[.12em]">VectorCAD</div><div className="text-[9px] tracking-[.28em] text-[#7e9187]">Converter</div></div></div>
      <div className="hidden items-center gap-2 text-xs text-[#91a097] md:flex"><span className="h-2 w-2 rounded-full bg-[#b7f34a]" /> {usageInfo ? `Plano ${usageInfo.plan.toUpperCase()} · ${usageInfo.usageLimit === null ? "uso ilimitado" : `${usageInfo.usage}/${usageInfo.usageLimit} usos hoje`}` : "Motor vetorial pronto"}</div>
      <button onClick={() => input.current?.click()} className="flex items-center gap-2 rounded-lg border border-[#3c4b44] px-3 py-2 text-xs font-bold hover:bg-[#18201c]"><Upload size={14} /> Nova imagem</button>
    </header>

    {!hasSource && <section className="mx-auto max-w-6xl px-5 pb-20 pt-16 text-center md:pt-24">
      <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-[#3d513e] bg-[#162219] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-[#b7f34a]"><Sparkles size={12} /> Raster para CAD editável</div>
      <h1 className="mx-auto max-w-3xl text-4xl font-black tracking-[-.045em] text-white md:text-6xl">Transforme imagens em <span className="text-[#b7f34a]">vetores para CAD</span></h1>
      <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#9faca6] md:text-base">Converta PNG, JPG e TIFF em SVG e DXF editável para AutoCAD, corte laser, CNC e projetos técnicos.</p>
      <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }} onClick={() => input.current?.click()} className={`mx-auto mt-10 max-w-3xl cursor-pointer rounded-2xl border border-dashed p-12 transition md:p-16 ${dragging ? "border-[#b7f34a] bg-[#17251a]" : "border-[#425148] bg-[#111714]/80 hover:border-[#829b83]"}`}>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#b7f34a] text-[#08110b]"><Upload size={26} /></div><h2 className="mt-5 text-lg font-bold">Arraste sua imagem para cá</h2><p className="mt-2 text-xs text-[#829087]">PNG, JPG, JPEG, WEBP, TIF ou TIFF · Máximo 12 MB</p><button className="mt-6 rounded-lg bg-white px-5 py-2.5 text-xs font-black text-[#101512]">Enviar imagem</button>
      </div>
      <div className="mx-auto mt-8 grid max-w-3xl grid-cols-3 gap-3 text-left"><Feature icon={<ScanLine />} title="Contornos reais" text="Polilinhas editáveis" /><Feature icon={<Crosshair />} title="Escala precisa" text="mm, cm ou pixels" /><Feature icon={<Layers3 />} title="Layers CAD" text="Contours e Details" /></div>
    </section>}

    {hasSource && <section className="workspace-layout min-h-[calc(100vh-64px)]" style={{ "--controls-width": `${panel.size}px`, "--cad-width": `${cadPanel.size}px` } as React.CSSProperties}>
      <aside className="controls-panel border-r border-[#26312c] bg-[#0d1210] p-4">
        <Section title="Pré-processamento" icon={<WandSparkles size={14} />}>
          <label className="text-[10px] uppercase tracking-wider text-[#77867e]">Qualidade da imagem</label>
          <select value={imageQuality} onChange={e => setImageQuality(e.target.value as ImageQuality)} className="w-full text-xs" title="Escolha entre preservar a imagem ou reforçar linhas técnicas para vetorização.">
            <option value="original">Original</option>
            <option value="enhanced">Melhorada</option>
            <option value="ultra">Ultra CAD</option>
            <option value="ultra-pro">Ultra CAD Pro</option>
          </select>
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

      <button type="button" aria-label="Redimensionar painel CAD" title="Arraste para redimensionar" onPointerDown={cadPanel.startResize} className={`panel-resizer panel-resizer-right ${cadPanel.resizing ? "is-resizing" : ""}`}><span /></button>
      <aside className="cad-panel border-l border-[#26312c] bg-[#0d1210] p-4">
        <Section title="Configurações CAD" icon={<Settings2 size={14} />}>
          <label className="text-[10px] uppercase tracking-wider text-[#77867e]">Unidade de saída</label><div className="grid grid-cols-3 gap-1">{(["mm", "cm", "px"] as Unit[]).map(u => <button key={u} onClick={() => setUnit(u)} className={`rounded-md py-2 text-xs font-bold ${unit === u ? "bg-[#b7f34a] text-[#0c150e]" : "bg-[#18201c] text-[#8f9d95]"}`}>{u}</button>)}</div>
          <div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-[#8d9a93]">Largura<input className="mt-1 w-full" type="number" min="0.1" value={realWidth} onChange={e => updateWidth(+e.target.value)} /></label><label className="text-[10px] text-[#8d9a93]">Altura<input className="mt-1 w-full" type="number" min="0.1" value={realHeight} onChange={e => updateHeight(+e.target.value)} /></label></div>
          <Toggle label="Manter proporção" checked={locked} onChange={setLocked} />
        </Section>
        <Section title="Resumo do vetor" icon={<Layers3 size={14} />}><Stat label="Caminhos" value={pathCount} /><Stat label="Pontos editáveis" value={pointCount} /><Stat label="Layer principal" value="CONTOURS" /><Stat label="Dimensão" value={`${realWidth} × ${realHeight} ${unit}`} /></Section>
        <div className="mt-5 rounded-xl border border-[#38483f] bg-[#151e19] p-3 text-[10px] leading-5 text-[#aab7b0]"><b className="text-[#b7f34a]">Contornos contínuos</b><br />O DXF usa LWPOLYLINEs editáveis, suavizadas e organizadas em layers.</div>
        <div className="mt-5 grid gap-2"><button onClick={() => exportFile("dxf")} className="flex items-center justify-center gap-2 rounded-lg bg-[#b7f34a] py-3 text-xs font-black text-[#0a120c]"><Download size={15} /> Exportar DXF</button><button onClick={() => exportFile("svg")} className="flex items-center justify-center gap-2 rounded-lg bg-white py-3 text-xs font-black text-[#111713]"><Download size={15} /> Exportar SVG</button><button onClick={exportPng} className="flex items-center justify-center gap-2 rounded-lg border border-[#3c4943] py-2.5 text-xs font-bold"><FileImage size={14} /> PNG preview</button><button onClick={generate3d} className="flex items-center justify-center gap-2 rounded-lg border border-[#b7f34a]/60 bg-[#182019] py-2.5 text-xs font-black text-[#b7f34a]"><Box size={14} /> Gerar modelo 3D</button></div>
        {show3d && <div className="relative mt-2"><button type="button" onClick={() => setShow3dOptions((value) => !value)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#b7f34a]/60 bg-[#182019] py-2.5 text-xs font-black text-[#b7f34a]"><ExternalLink size={14} /> Visualizar 3D</button>{show3dOptions && <div className="absolute bottom-full left-0 z-30 mb-2 w-full rounded-xl border border-[#3b4d40] bg-[#101813] p-2 shadow-2xl shadow-black/50"><button type="button" onClick={() => setShow3dOptions(false)} className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-bold text-[#dce8e1] transition hover:bg-[#243327] hover:text-[#b7f34a]">Abrir visualizador 3D nesta tela</button><button type="button" onClick={() => void open3dInNewTab()} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-[11px] font-bold text-[#dce8e1] transition hover:bg-[#243327] hover:text-[#b7f34a]">Abrir visualizador 3D em nova guia</button></div>}</div>}
        {show3d && <div className="mt-5"><SvgTo3DCadViewer svg={svg} fileName={fileName} unit={unit} /></div>}
      </aside>
    </section>}
    <footer className="border-t border-[#26312c] bg-[#080c0b]/90 px-5 py-6 text-center">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-5 text-center md:flex-row md:gap-8">
        <div className="max-w-xs">
          <div className="text-sm font-black tracking-[.12em] text-[#b7f34a]">VectorCAD</div>
          <div className="mt-2 text-[11px] text-[#8b9a92]">A inteligência aplicada aos seus projetos de engenharia.</div>
        </div>
        <div className="mx-auto hidden h-12 w-px bg-[#304238] md:block" aria-hidden="true" />
        <div className="max-w-xs">
          <div className="text-xs font-black tracking-[.08em] text-[#b7f34a]">Grupo ShiftCore</div>
          <div className="mt-2 text-[11px] text-[#8b9a92]">Tecnologia, inovação e soluções inteligentes.</div>
        </div>
      </div>
    </footer>
    <input ref={input} type="file" accept=".png,.jpg,.jpeg,.webp,.tif,.tiff,image/png,image/jpeg,image/webp,image/tiff" className="hidden" onChange={e => loadFile(e.target.files?.[0])} />
    {upgradeModal && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[#b7f34a]/40 bg-[#101613] p-6 text-center shadow-2xl shadow-black/50">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#b7f34a] text-[#09120d]"><Sparkles size={22} /></div>
        <h3 className="mt-4 text-xl font-black">Limite diario atingido</h3>
        <p className="mt-3 text-sm leading-6 text-[#9caaa3]">{upgradeModal}</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setUpgradeModal("")} className="rounded-xl border border-[#34413b] px-4 py-3 text-xs font-black text-[#d6e0da] transition hover:border-[#b7f34a] hover:text-[#b7f34a]">Agora não</button>
          <a href="/pricing" className="rounded-xl bg-[#b7f34a] px-4 py-3 text-xs font-black text-[#09120d] transition hover:brightness-105">Fazer upgrade</a>
        </div>
      </div>
    </div>}
  </main>;
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="mb-5 border-b border-[#26312c] pb-5"><h3 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[#e7eee9]">{icon}{title}<ChevronDown size={12} className="ml-auto text-[#74847b]" /></h3><div className="grid gap-4">{children}</div></section>; }
function Stat({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex items-center justify-between text-[10px] text-[#829189]"><span>{label}</span><b className="text-[#dce6e0]">{value}</b></div>; }
function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="panel rounded-xl p-3 md:p-4"><div className="text-[#b7f34a] [&>svg]:h-4 [&>svg]:w-4">{icon}</div><div className="mt-3 text-xs font-bold">{title}</div><div className="mt-1 text-[10px] text-[#7f8d85]">{text}</div></div>; }

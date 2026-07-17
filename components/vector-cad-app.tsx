"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, ChevronDown, Crosshair, Download, ExternalLink, FileImage, Layers3, Maximize2, MousePointer2, RotateCcw, ScanLine, Settings2, Sparkles, Upload, WandSparkles, ZoomIn, ZoomOut } from "lucide-react";
import { useResizablePanel } from "@/components/hooks/use-resizable-panel";
import { useZoomPan } from "@/components/hooks/use-zoom-pan";
import { useLocalProjectDraft } from "@/components/hooks/use-local-project-draft";
import { SvgTo3DCadViewer } from "@/components/SvgTo3DCadViewer";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { enhanceForCad, processPixels } from "@/lib/image-processing/process";
import { processCadCleanImage, type CadCleanMetrics } from "@/lib/image-processing/cad-clean";
import { decodeTiffDataUrl, isTiffFile, processTiff, type TiffRaster } from "@/lib/image-processing/tiff";
import { detectText, protectTextRegions, type OcrDiagnostic } from "@/lib/text-detection/ocr";
import { type AiDetectedElement, type AiFeedback, type AiTextElement, type VectorCadAiAnalysis } from "@/lib/ai/vectorcad-ai";
import type { RecognizedDimension } from "@/lib/ai/dimension-recognition";
import { scaleDocument, vectorizeBitmap } from "@/lib/vectorize/contours";
import { cleanupVectorDocument } from "@/lib/vector/vector-cleanup";
import { lineIntelligenceEngine, type LineIntelligenceMetrics } from "@/lib/vector/line-intelligence";
import { generateSvg } from "@/lib/exporters/svg";
import { countDxfEntities, generateDxf } from "@/lib/exporters/dxf";
import type { DetectedText, ImageQuality, LineProcessingMode, OutputMode, ProcessingSettings, Unit, VectorDocument, VectorMode, VectorSettings } from "@/types/vector";
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

function DiagnosticImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  // These previews are in-memory data URLs; Next Image is not useful for this temporary diagnostic panel.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}

function aiTextKey(text: AiTextElement, index: number) {
  return `${index}:${text.value}:${Math.round(text.position.x)}:${Math.round(text.position.y)}`;
}

function aiElementColor(element: AiDetectedElement, threshold: number) {
  if (element.confidence < threshold || element.confidence < .5) return { border: "#ff5c57", text: "#ff8b87" };
  if (["EQUIPMENT", "INSTRUMENT", "VALVE", "PUMP", "MOTOR", "PANEL"].includes(element.type)) return { border: "#b7f34a", text: "#d7ff9b" };
  if (["SYMBOL", "CONNECTION", "POSSIBLE_DIMENSION"].includes(element.type)) return { border: "#ffd34d", text: "#ffe38a" };
  return { border: "#54a9ff", text: "#8cc7ff" };
}

function AiAnalysisOverlay({ elements, threshold, selectedIndex, onSelect }: { elements: AiDetectedElement[]; threshold: number; selectedIndex: number | null; onSelect: (index: number) => void }) {
  return <div className="pointer-events-none absolute inset-0 z-10">
    {elements.map((element, index) => {
      if (element.confidence < threshold) return null;
      const color = aiElementColor(element, threshold);
      return <button key={`${element.id}-${index}`} type="button" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onSelect(index); }} className="pointer-events-auto absolute border-2 bg-transparent text-left transition hover:bg-white/10" style={{ left: `${element.boundingBox.x}px`, top: `${element.boundingBox.y}px`, width: `${Math.max(element.boundingBox.width, 8)}px`, height: `${Math.max(element.boundingBox.height, 8)}px`, borderColor: color.border, boxShadow: selectedIndex === index ? `0 0 0 2px ${color.border}` : undefined }} title={`${element.name} · ${element.type} · ${Math.round(element.confidence * 100)}%`}>
        <span className="absolute left-0 top-full mt-0.5 whitespace-nowrap rounded bg-[#07100a]/90 px-1 py-0.5 text-[8px] font-bold" style={{ color: color.text }}>{element.type} · {Math.round(element.confidence * 100)}% · {element.source}</span>
      </button>;
    })}
  </div>;
}

function DimensionOverlay({ dimensions, threshold, selectedIndex, onSelect }: { dimensions: RecognizedDimension[]; threshold: number; selectedIndex: number | null; onSelect: (index: number) => void }) {
  return <div className="pointer-events-none absolute inset-0 z-10">
    {dimensions.map((dimension, index) => dimension.confidence >= threshold && <button key={dimension.id} type="button" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onSelect(index); }} className="pointer-events-auto absolute border-2 border-[#ff8a3d] bg-[#ff8a3d]/10 text-left" style={{ left: `${dimension.boundingBox.x}px`, top: `${dimension.boundingBox.y}px`, width: `${Math.max(dimension.boundingBox.width, 12)}px`, height: `${Math.max(dimension.boundingBox.height, 10)}px`, boxShadow: selectedIndex === index ? "0 0 0 2px #ff8a3d" : undefined }} title={`${dimension.value} ${dimension.unit} · ${Math.round(dimension.confidence * 100)}%`}><span className="absolute left-0 top-full mt-0.5 whitespace-nowrap rounded bg-[#07100a]/90 px-1 py-0.5 text-[8px] font-bold text-[#ffb27d]">{dimension.value} {dimension.unit} · {dimension.orientation}</span></button>)}
  </div>;
}

export function VectorCadApp({ onUsageChange, initialData, onProjectChange, onPrepare3dProject, projectId, userId, draftClearSignal }: { onUsageChange?: (usage: UsageInfo) => void; initialData?: CadProjectData | null; onProjectChange?: (data: CadProjectData) => void; onPrepare3dProject?: (data: CadProjectData) => Promise<string | null>; projectId?: string | null; userId?: string | null; draftClearSignal?: string }) {
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [sourceRaster, setSourceRaster] = useState<TiffRaster | null>(null);
  const [sourceFormat, setSourceFormat] = useState<"raster" | "tiff">(initialData?.sourceFormat || "raster");
  const [sourceImageDataUrl, setSourceImageDataUrl] = useState(initialData?.sourceImageDataUrl || "");
  const [processedPreview, setProcessedPreview] = useState("");
  const [sourceOriginalDataUrl, setSourceOriginalDataUrl] = useState(initialData?.sourceOriginalDataUrl || "");
  const [fileName, setFileName] = useState(initialData?.fileName || "");
  const [processing, setProcessing] = useState(initialData?.processing || defaultProcessing);
  const [imageQuality, setImageQuality] = useState<ImageQuality>(initialData?.imageQuality || "enhanced");
  const [lineProcessingMode, setLineProcessingMode] = useState<LineProcessingMode>(initialData?.lineProcessingMode || "manual");
  const [textDetectionEnabled, setTextDetectionEnabled] = useState(initialData?.textDetectionEnabled || false);
  const [detectedTexts, setDetectedTexts] = useState<DetectedText[]>(initialData?.textDetectionEnabled ? (initialData.detectedTexts || []) : []);
  const [textDetectionStatus, setTextDetectionStatus] = useState("");
  const [ocrDiagnostic, setOcrDiagnostic] = useState<OcrDiagnostic | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<VectorCadAiAnalysis | null>(initialData?.aiAnalysis || null);
  const [exportSmartTexts, setExportSmartTexts] = useState(initialData?.exportSmartTexts ?? true);
  const [aiFeedback, setAiFeedback] = useState<AiFeedback[]>(initialData?.aiFeedback || []);
  const [showAiOverlay, setShowAiOverlay] = useState(false);
  const [aiConfidenceThreshold, setAiConfidenceThreshold] = useState(0);
  const [selectedAiText, setSelectedAiText] = useState<number | null>(null);
  const [selectedAiElement, setSelectedAiElement] = useState<number | null>(null);
  const [selectedAiDimension, setSelectedAiDimension] = useState<number | null>(null);
  const [aiStatus, setAiStatus] = useState("");
  const [visionStatus, setVisionStatus] = useState<"idle" | "executed" | "fallback" | "skipped">("idle");
  const [aiRunning, setAiRunning] = useState(false);
  const [vector, setVector] = useState(initialData?.vector || defaultVector);
  const [doc, setDoc] = useState<VectorDocument | null>(initialData?.document || null);
  const [cleanupStats, setCleanupStats] = useState({ beforePaths: 0, afterPaths: 0, beforePoints: 0, afterPoints: 0, reductionPercent: 0 });
  const [cadCleanMetrics, setCadCleanMetrics] = useState<CadCleanMetrics>({ pixelsProcessed: 0, noiseRemoved: 0, contrastApplied: 0 });
  const [lineMetrics, setLineMetrics] = useState<LineIntelligenceMetrics>({ detected: 0, kept: 0, removed: 0, unified: 0, reductionPercent: 0 });
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
      setLineProcessingMode(saved?.lineProcessingMode || "manual");
      setTextDetectionEnabled(saved?.textDetectionEnabled || false);
      setDetectedTexts(saved?.textDetectionEnabled ? (saved.detectedTexts || []) : []);
      setAiAnalysis(saved?.aiAnalysis || null);
      setExportSmartTexts(saved?.exportSmartTexts ?? true);
      setAiFeedback(saved?.aiFeedback || []);
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
    setLineProcessingMode(saved.lineProcessingMode || "manual");
    setTextDetectionEnabled(saved.textDetectionEnabled || false);
    setDetectedTexts(saved.textDetectionEnabled ? (saved.detectedTexts || []) : []);
    setAiAnalysis(saved.aiAnalysis || null);
    setExportSmartTexts(saved.exportSmartTexts ?? true);
    setAiFeedback(saved.aiFeedback || []);
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
      lineProcessingMode,
      textDetectionEnabled,
      detectedTexts,
      aiAnalysis: aiAnalysis || undefined,
      exportSmartTexts,
      aiFeedback,
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
  }, [activeView, aiAnalysis, aiFeedback, detectedTexts, doc, exportSmartTexts, fileName, imageQuality, lineProcessingMode, locked, onProjectChange, processing, realHeight, realWidth, saveDraft, show3d, sourceFormat, sourceImageDataUrl, sourceOriginalDataUrl, textDetectionEnabled, unit, vector]);

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
    if (!file) return;
    setAiAnalysis(null);
    setAiStatus("");
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
    const sourceImage = ctx.getImageData(0, 0, w, h);
    const cadClean = imageQuality === "cad-clean" ? processCadCleanImage(sourceImage) : null;
    const enhanced = cadClean?.image || enhanceForCad(sourceImage, imageQuality);
    setCadCleanMetrics(cadClean?.metrics || { pixelsProcessed: 0, noiseRemoved: 0, contrastApplied: 0 });
    const result = processPixels(enhanced, processing);
    const bitmap = detectedTexts.length ? protectTextRegions(result.bitmap, w, h, detectedTexts) : result.bitmap;
    if (detectedTexts.length) {
      for (let i = 0; i < bitmap.length; i += 1) {
        if (!bitmap[i]) {
          const offset = i * 4;
          result.image.data[offset] = 255;
          result.image.data[offset + 1] = 255;
          result.image.data[offset + 2] = 255;
          result.image.data[offset + 3] = 255;
        }
      }
    }
    pc.getContext("2d")!.putImageData(result.image, 0, 0);
    setProcessedPreview(pc.toDataURL("image/png"));
    const rawDocument = vectorizeBitmap(bitmap, w, h, vector);
    const detectedLines = lineIntelligenceEngine.analyze(rawDocument.paths, w, h);
    const lineSelection = lineIntelligenceEngine.selectPaths(rawDocument.paths, detectedLines, lineProcessingMode, w, h);
    const intelligentPaths = lineSelection.paths;
    const cleanupMode = vector.outputMode === "pixel" ? "original" : vector.outputMode === "cad" ? "cad-clean" : "smooth";
    const cleanup = cleanupVectorDocument({ ...rawDocument, paths: intelligentPaths }, cleanupMode);
    if (!cleanup.document.paths.length && lineProcessingMode === "auto") {
      for (const fallbackQuality of ["cad-clean", "ultra-pro"] as ImageQuality[]) {
        const fallbackSource = fallbackQuality === "cad-clean" ? processCadCleanImage(sourceImage).image : enhanceForCad(sourceImage, fallbackQuality);
        const fallbackResult = processPixels(fallbackSource, processing);
        const fallbackBitmap = detectedTexts.length ? protectTextRegions(fallbackResult.bitmap, w, h, detectedTexts) : fallbackResult.bitmap;
        const fallbackRaw = vectorizeBitmap(fallbackBitmap, w, h, vector);
        const fallbackLines = lineIntelligenceEngine.analyze(fallbackRaw.paths, w, h);
        const fallbackSelection = lineIntelligenceEngine.selectPaths(fallbackRaw.paths, fallbackLines, lineProcessingMode, w, h);
        const fallbackPaths = fallbackSelection.paths;
        const fallbackCleanup = cleanupVectorDocument({ ...fallbackRaw, paths: fallbackPaths }, cleanupMode);
        if (fallbackCleanup.document.paths.length) {
          cleanup.document = fallbackCleanup.document;
          cleanup.beforePaths = fallbackCleanup.beforePaths;
          cleanup.beforePoints = fallbackCleanup.beforePoints;
          cleanup.afterPaths = fallbackCleanup.afterPaths;
          cleanup.afterPoints = fallbackCleanup.afterPoints;
          cleanup.reductionPercent = fallbackCleanup.reductionPercent;
          detectedLines.splice(0, detectedLines.length, ...fallbackLines);
          intelligentPaths.splice(0, intelligentPaths.length, ...fallbackPaths);
          lineSelection.unified = fallbackSelection.unified;
          fallbackResult.image.data.forEach((value, index) => { if (result.image.data[index] !== value) result.image.data[index] = value; });
          break;
        }
      }
    }
    if (!cleanup.document.paths.length) {
      setLineMetrics({ detected: detectedLines.length, kept: 0, removed: detectedLines.length, unified: 0, reductionPercent: detectedLines.length ? 100 : 0 });
      setMessage("Nenhuma linha foi detectada. O resultado anterior foi preservado; tente CAD Clean ou Ultra CAD Pro.");
      return;
    }
    setLineMetrics(lineIntelligenceEngine.metrics(detectedLines, intelligentPaths, lineSelection.unified));
    setCleanupStats({ beforePaths: cleanup.beforePaths, afterPaths: cleanup.afterPaths, beforePoints: cleanup.beforePoints, afterPoints: cleanup.afterPoints, reductionPercent: cleanup.reductionPercent });
    setDoc(cleanup.document);
    if (result.darkRatio > .55) setMessage("Foram detectadas muitas áreas escuras. Tente ajustar o threshold ou inverter as cores.");
    else if (result.darkRatio < .003) setMessage("A imagem tem pouco contraste. Tente aumentar o threshold.");
  }, [detectedTexts, imageQuality, lineProcessingMode, processing, source, sourceRaster, vector]);

  useEffect(() => {
    if (!textDetectionEnabled) {
      return;
    }
    const canvas = originalCanvas.current;
    if (!canvas || !canvas.width || !canvas.height) return;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    let cancelled = false;
    setTextDetectionStatus("Analisando textos...");
    const original = context.getImageData(0, 0, canvas.width, canvas.height);
    const enhanced = enhanceForCad(original, "ultra-pro");
    void detectText(enhanced, original).then((result) => {
      if (cancelled) return;
      setDetectedTexts(result.texts);
      setOcrDiagnostic(result.diagnostic);
      setTextDetectionStatus(`Regiões analisadas: ${result.regionsAnalyzed} · Textos encontrados: ${result.texts.length}`);
    }).catch(() => {
      if (cancelled) return;
      setDetectedTexts([]);
      setTextDetectionStatus("Não foi possível analisar os textos desta imagem.");
    });
    return () => { cancelled = true; };
  }, [imageQuality, source, sourceRaster, textDetectionEnabled]);

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
    const smartTexts = kind === "dxf" && exportSmartTexts ? (aiAnalysis?.texts || []) : [];
    download(`${fileName.replace(/\.[^.]+$/, "") || "vectorcad"}.${kind}`, kind === "svg" ? svg : generateDxf(finalDoc, smartTexts), kind === "svg" ? "image/svg+xml" : "application/dxf");
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
  const analyzeWithAi = async () => {
    const image = processedCanvas.current;
    if (!image || !doc) {
      setAiStatus("Carregue e vetorize uma imagem antes da análise.");
      return;
    }
    const context = image.getContext("2d", { willReadFrequently: true });
    if (!context) {
      setAiStatus("Não foi possível preparar a imagem para a análise.");
      return;
    }
    setAiRunning(true);
    setAiStatus("Analisando com o VectorCAD AI...");
    try {
      if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("SESSION_MISSING");
      const response = await fetch("/api/ai/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({
          imageDataUrl: image.toDataURL("image/png"),
          ocrTexts: detectedTexts,
          vectors: doc,
          dimensions: { width: realWidth, height: realHeight, unit },
          context: { editorMode: show3d ? "cad3d" : "cad2d", fileName, sourceFormat, imageQuality },
        }),
      });
      const payload = await response.json().catch(() => null) as { analysis?: VectorCadAiAnalysis; vision?: { status?: string; reason?: string }; error?: string } | null;
      if (!response.ok || !payload?.analysis) throw new Error(payload?.error || "AI_ANALYSIS_FAILED");
      const analysis = payload.analysis;
      setAiAnalysis(analysis);
      setSelectedAiText(null);
      setSelectedAiElement(null);
      setVisionStatus(payload.vision?.status === "executed" ? "executed" : payload.vision?.status === "fallback" ? "fallback" : "skipped");
      const visionStatus = payload.vision?.status === "executed" ? "OCR + Vision AI" : payload.vision?.status === "fallback" ? "OCR local (Vision AI indisponível)" : "OCR local (confiança suficiente)";
      setAiStatus(`${visionStatus} · ${analysis.elements.length} elementos encontrados`);
    } catch (error) {
      console.warn("[VectorCAD][AI] análise não concluída", { reason: error instanceof Error ? error.message : "AI_UNKNOWN_ERROR" });
      setVisionStatus("idle");
      setAiStatus("Não foi possível concluir a análise de IA.");
    } finally {
      setAiRunning(false);
    }
  };
  const setAiTextFeedback = (status: AiFeedback["status"]) => {
    if (selectedAiText === null || !aiAnalysis?.texts[selectedAiText]) return;
    const text = aiAnalysis.texts[selectedAiText];
    const feedback: AiFeedback = { elementKey: aiTextKey(text, selectedAiText), status, createdAt: new Date().toISOString() };
    setAiFeedback(current => [...current.filter(item => item.elementKey !== feedback.elementKey), feedback]);
  };
  const setAiElementFeedback = (status: AiFeedback["status"]) => {
    if (selectedAiElement === null || !aiAnalysis?.elements?.[selectedAiElement]) return;
    const element = aiAnalysis.elements[selectedAiElement];
    const feedback: AiFeedback = { elementKey: `ai-element:${element.id}`, status, createdAt: new Date().toISOString() };
    setAiFeedback(current => [...current.filter(item => item.elementKey !== feedback.elementKey), feedback]);
  };
  const open3dInNewTab = async () => {
    if (!finalDoc || !svg) {
      setMessage("Vetorize uma imagem antes de abrir o visualizador 3D.");
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
      textDetectionEnabled,
      detectedTexts,
      vector,
      document: doc,
      unit,
      realWidth,
      realHeight,
      locked,
      activeView,
    };
    if (!projectId) setMessage("Salvando projeto para abrir visualização 3D...");
    const savedProjectId = projectId || await onPrepare3dProject?.(data);
    if (!savedProjectId) {
      console.info("[VectorCAD][3D] project id unavailable", { hasProjectId: false });
      setMessage("Salve o projeto antes de abrir o visualizador em nova guia.");
      return;
    }

    const viewerUrl = `/projetos/${encodeURIComponent(savedProjectId)}/3d`;
    console.info("[VectorCAD][3D] opening new tab", { pathname: viewerUrl, hasProjectId: Boolean(savedProjectId) });
    try {
      const newTab = window.open(viewerUrl, "_blank", "noopener,noreferrer");
      console.info("[VectorCAD][3D] window.open result", { opened: Boolean(newTab) });
      if (!newTab) {
        setMessage("O navegador bloqueou a nova guia. Permita pop-ups para o VectorCAD.");
        return;
      }
    } catch (error) {
      console.error("[VectorCAD][3D] redirect failed", { code: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
      setMessage("Não foi possível abrir o visualizador 3D em uma nova guia.");
      return;
    }
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
            <option value="cad-clean">CAD Clean Image</option>
          </select>
          {imageQuality === "cad-clean" && <div className="mt-3 rounded-lg border border-[#33433a] bg-[#111914] p-2 text-[10px] text-[#aab8b0]">
            <p className="font-bold text-[#b7f34a]">Original vs CAD Clean Image</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <figure>
                <figcaption className="mb-1 text-[#829087]">Original</figcaption>
                <DiagnosticImage src={sourceOriginalDataUrl || sourceImageDataUrl} alt="Imagem original" className="h-24 w-full object-contain bg-white" />
              </figure>
              <figure>
                <figcaption className="mb-1 text-[#829087]">CAD Clean Image</figcaption>
                <DiagnosticImage src={processedPreview || sourceOriginalDataUrl || sourceImageDataUrl} alt="Imagem CAD Clean" className="h-24 w-full object-contain bg-white" />
              </figure>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 leading-4">
              <span>Pixels tratados: {cadCleanMetrics.pixelsProcessed.toLocaleString("pt-BR")}</span>
              <span>Ruído removido: {cadCleanMetrics.noiseRemoved.toLocaleString("pt-BR")}</span>
              <span>Contraste aplicado: {cadCleanMetrics.contrastApplied.toFixed(1)}</span>
            </div>
          </div>}
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 text-xs text-[#bdc9c3]" title="Detecta letras e números para proteger essas regiões da vetorização.">
            <span>Reconhecimento inteligente</span>
            <input type="checkbox" checked={textDetectionEnabled} onChange={e => { setTextDetectionEnabled(e.target.checked); if (!e.target.checked) { setDetectedTexts([]); setOcrDiagnostic(null); } }} className="h-4 w-4 accent-[#b7f34a]" />
          </label>
          {textDetectionEnabled && <p className="mt-2 text-[10px] leading-4 text-[#829087]">{textDetectionStatus || "Detectar textos antes da vetorização."}</p>}
          {textDetectionEnabled && ocrDiagnostic && <details className="mt-3 rounded-lg border border-[#33433a] bg-[#111914] p-2 text-[10px] text-[#aab8b0]">
            <summary className="cursor-pointer font-bold text-[#b7f34a]">Diagnóstico visual do OCR</summary>
            <div className="mt-2 grid grid-cols-2 gap-2 leading-4">
              <span>Imagem OCR: {ocrDiagnostic.imageWidth} × {ocrDiagnostic.imageHeight}</span>
              <span>Componentes: {ocrDiagnostic.componentsFound}</span>
              <span>Regiões: {ocrDiagnostic.regionsCreated}</span>
              <span>Chamadas Tesseract: {ocrDiagnostic.tesseractCalls}</span>
              <span>Resultados brutos: {ocrDiagnostic.rawResults}</span>
              <span>Resultados aceitos: {ocrDiagnostic.acceptedResults}</span>
              <span>Variantes testadas: {ocrDiagnostic.variantsTested}</span>
              <span>Melhor variante: {ocrDiagnostic.bestVariant}</span>
              <span>Melhor confiança: {Math.round(ocrDiagnostic.bestConfidence * 100)}%</span>
              <span>Recorte médio: {ocrDiagnostic.averageCropWidth} × {ocrDiagnostic.averageCropHeight}</span>
            </div>
            <div className="mt-2 grid gap-2">
              <div className="rounded border border-[#33433a] bg-[#0b110d] p-2"><b className="text-[#b7f34a]">OCR direto · PSM {ocrDiagnostic.directOcr.psm}</b><div className="mt-1 whitespace-pre-wrap break-words text-[#e8efeb]">{ocrDiagnostic.directOcr.rawText || "(sem texto bruto)"}</div><div className="mt-1 text-[#829087]">Confiança: {Math.round(ocrDiagnostic.directOcr.confidence * 100)}%</div></div>
              <div className="rounded border border-[#33433a] bg-[#0b110d] p-2"><b className="text-[#b7f34a]">Worker Tesseract</b><div className="mt-1 text-[#aab8b0]">Criado: {ocrDiagnostic.worker.created ? "sim" : "não"} · Modelos: {ocrDiagnostic.worker.languages.join(", ")} · Versão: {ocrDiagnostic.worker.version}</div><div className="mt-1 text-[#829087]">Entrada: {ocrDiagnostic.inputStats.width} × {ocrDiagnostic.inputStats.height} · {ocrDiagnostic.inputStats.format} · não transparentes: {ocrDiagnostic.inputStats.nonTransparentPixels} · escuros: {ocrDiagnostic.inputStats.darkPixels}</div></div>
              <div className="rounded border border-[#33433a] bg-[#0b110d] p-2"><b className="text-[#b7f34a]">Teste interno: TESTE 123</b><div className="mt-1 space-y-1 text-[#e8efeb]">{ocrDiagnostic.syntheticOcr.map(result => <div key={result.language}><span className="text-[#829087]">{result.language}:</span> {result.rawText || "(sem texto bruto)"} <span className="text-[#829087]">· {Math.round(result.confidence * 100)}%</span></div>)}</div></div>
              <div className="grid grid-cols-3 gap-1"><figure><figcaption className="mb-1 text-[#829087]">Original</figcaption><DiagnosticImage src={ocrDiagnostic.originalImage} alt="Imagem original enviada ao OCR" className="h-24 w-full object-contain bg-white" /></figure><figure><figcaption className="mb-1 text-[#829087]">Grayscale</figcaption><DiagnosticImage src={ocrDiagnostic.grayscaleImage} alt="Imagem grayscale do OCR" className="h-24 w-full object-contain bg-white" /></figure><figure><figcaption className="mb-1 text-[#829087]">Threshold</figcaption><DiagnosticImage src={ocrDiagnostic.thresholdImage} alt="Imagem após threshold do OCR" className="h-24 w-full object-contain bg-white" /></figure></div>
              <figure><figcaption className="mb-1 text-[#829087]">Imagem binarizada</figcaption><DiagnosticImage src={ocrDiagnostic.binaryImage} alt="Imagem binarizada enviada ao OCR" className="max-h-32 w-full object-contain bg-white" /></figure>
              <figure><figcaption className="mb-1 text-[#829087]">Máscara e regiões candidatas</figcaption><DiagnosticImage src={ocrDiagnostic.regionMask} alt="Máscara de regiões candidatas do OCR" className="max-h-32 w-full object-contain bg-white" /></figure>
              {ocrDiagnostic.variantPreviews.length > 0 && <figure><figcaption className="mb-1 text-[#829087]">Variantes do primeiro recorte</figcaption><div className="grid grid-cols-5 gap-1">{ocrDiagnostic.variantPreviews.map(variant => <div key={variant.name}><DiagnosticImage src={variant.image} alt={`Variante ${variant.name}`} className="h-16 w-full object-contain bg-white" /><span className="block truncate text-center text-[8px]">{variant.name}</span></div>)}</div></figure>}
              {ocrDiagnostic.cropPreviews.length > 0 && <figure><figcaption className="mb-1 text-[#829087]">Recortes enviados ao Tesseract</figcaption><div className="grid grid-cols-4 gap-1">{ocrDiagnostic.cropPreviews.map((preview, index) => <DiagnosticImage key={`${preview.slice(-24)}-${index}`} src={preview} alt={`Recorte OCR ${index + 1}`} className="h-12 w-full object-contain bg-white" />)}</div></figure>}
              {ocrDiagnostic.rawAttempts.length > 0 && <div><figcaption className="mb-1 text-[#829087]">Retorno bruto de cada tentativa</figcaption><div className="max-h-52 space-y-1 overflow-auto">{ocrDiagnostic.rawAttempts.map((attempt, index) => <div key={`${attempt.variant}-${attempt.psm}-${index}`} className="rounded bg-[#0b110d] p-1.5"><div className="text-[#b7f34a]">{attempt.variant} · PSM {attempt.psm} · {attempt.originalWidth}×{attempt.originalHeight} → {attempt.resizedWidth}×{attempt.resizedHeight} · {Math.round(attempt.confidence * 100)}%</div><div className="whitespace-pre-wrap break-words text-[#e8efeb]">{attempt.rawText || "(vazio)"}</div></div>)}</div></div>}
            </div>
          </details>}
          <div className="mt-4 rounded-lg border border-[#33433a] bg-[#111914] p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#b7f34a]"><Sparkles size={13} /> VectorCAD AI</div>
            <p className="mt-1 text-[10px] leading-4 text-[#829087]">{aiStatus || "Combine o OCR local com a análise inteligente do projeto."}</p>
            {aiAnalysis && <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] text-[#aab8b0]"><span>OCR: <b className="text-[#b7f34a]">✓ executado</b></span><span>Vision AI: <b className={visionStatus === "executed" ? "text-[#b7f34a]" : "text-[#829087]"}>{visionStatus === "executed" ? "✓ executado" : visionStatus === "fallback" ? "fallback OCR" : "não acionada"}</b></span></div>}
            <button type="button" disabled={aiRunning} onClick={() => void analyzeWithAi()} className="mt-2 w-full rounded-md bg-[#b7f34a] px-2 py-2 text-[10px] font-black text-[#0c150e] disabled:cursor-wait disabled:opacity-60">{aiRunning ? "Analisando..." : "Analisar projeto"}</button>
            <div className="mt-3 rounded border border-[#29372f] bg-[#0b110d] p-2 text-[9px] text-[#aab8b0]">
              <div className="grid grid-cols-3 gap-1 text-center">
                <span><b className="block text-[#54a9ff]">{detectedTexts.length}</b>OCR encontrados</span>
                <span><b className="block text-[#b7f34a]">{visionStatus === "executed" ? "Sim" : "Não"}</b>Vision AI</span>
                <span><b className="block text-[#e8efeb]">{aiAnalysis?.texts.length || 0}</b>resultado final</span>
              </div>
              {aiAnalysis && <div className="mt-2 grid grid-cols-3 gap-1 border-t border-[#29372f] pt-2 text-center">
                <span><b className="block text-[#e8efeb]">{aiAnalysis.texts.filter(text => text.type === "TITLE").length}</b>TITLE</span>
                <span><b className="block text-[#e8efeb]">{aiAnalysis.texts.filter(text => text.type === "LABEL" || text.type === "ROOM_NAME").length}</b>LABEL</span>
                <span><b className="block text-[#e8efeb]">{aiAnalysis.texts.filter(text => ["ANNOTATION", "NOTE", "SCALE"].includes(text.type)).length}</b>ANNOTATION</span>
                <span><b className="block text-[#e8efeb]">{Math.round(aiAnalysis.confidence * 100)}%</b>confiança média</span>
              </div>}
            </div>
            <label className="mt-3 flex cursor-pointer items-center justify-between gap-2 text-[10px] text-[#bdc9c3]"><span>Visualizar análise IA</span><input type="checkbox" checked={showAiOverlay} onChange={e => setShowAiOverlay(e.target.checked)} className="h-4 w-4 accent-[#b7f34a]" /></label>
            {showAiOverlay && <Slider label="Confiança mínima (%)" value={Math.round(aiConfidenceThreshold * 100)} min={0} max={100} onChange={value => setAiConfidenceThreshold(value / 100)} />}
            {showAiOverlay && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[#aab8b0]"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#b7f34a]" />Texto exportável</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#54a9ff]" />Anotação</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#ffd34d]" />Possível cota</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#ff5c57]" />Baixa confiança</span></div>}
            <label className="mt-3 flex cursor-pointer items-center justify-between gap-2 text-[10px] text-[#bdc9c3]"><span>Exportar textos inteligentes</span><input type="checkbox" checked={exportSmartTexts} onChange={e => setExportSmartTexts(e.target.checked)} className="h-4 w-4 accent-[#b7f34a]" /></label>
            <p className="mt-1 text-[9px] text-[#829087]">{aiAnalysis?.texts.filter(text => ["TEXT", "LABEL", "TITLE", "ANNOTATION"].includes(text.type)).length || 0} textos serão exportados como CAD TEXT.</p>
            {aiAnalysis && <>
              <div className="mt-2 grid grid-cols-2 gap-1 text-center text-[9px] text-[#aab8b0]">
                <span><b className="block text-[#e8efeb]">{aiAnalysis.texts.length}</b>textos</span>
                <span><b className="block text-[#e8efeb]">{aiAnalysis.texts.filter(text => text.type === "TITLE").length}</b>títulos</span>
                <span><b className="block text-[#e8efeb]">{aiAnalysis.texts.filter(text => text.type === "ANNOTATION").length}</b>anotações</span>
                <span><b className="block text-[#e8efeb]">{aiAnalysis.texts.filter(text => text.type === "POSSIBLE_DIMENSION").length}</b>cotas possíveis</span>
                <span><b className="block text-[#e8efeb]">{aiAnalysis.elements?.length || 0}</b>elementos detectados</span>
                <span><b className="block text-[#e8efeb]">{Math.round(aiAnalysis.confidence * 100)}%</b>confiança</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 border-t border-[#29372f] pt-2 text-center text-[9px] text-[#aab8b0]">
                <span><b className="block text-[#e8efeb]">{aiAnalysis.elements?.filter(element => ["TEXT", "TITLE", "LABEL", "ANNOTATION"].includes(element.type)).length || 0}</b>textos</span>
                <span><b className="block text-[#b7f34a]">{aiAnalysis.elements?.filter(element => ["EQUIPMENT", "INSTRUMENT", "VALVE", "PUMP", "MOTOR", "PANEL"].includes(element.type)).length || 0}</b>equipamentos</span>
                <span><b className="block text-[#ffd34d]">{aiAnalysis.elements?.filter(element => ["SYMBOL", "CONNECTION"].includes(element.type)).length || 0}</b>símbolos</span>
                <span><b className="block text-[#ffd34d]">{aiAnalysis.elements?.filter(element => element.type === "POSSIBLE_DIMENSION").length || 0}</b>possíveis cotas</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-center text-[9px] text-[#aab8b0]"><span><b className="block text-[#e8efeb]">{aiAnalysis.visionObjects?.length || 0}</b>objetos detectados</span><span><b className="block text-[#b7f34a]">{aiAnalysis.visionObjects?.length ? Math.round(aiAnalysis.visionObjects.reduce((sum, object) => sum + object.confidence, 0) / aiAnalysis.visionObjects.length * 100) : 0}%</b>confiança dos objetos</span></div>
              <div className="mt-2 grid grid-cols-2 gap-1 border-t border-[#29372f] pt-2 text-center text-[9px] text-[#aab8b0]"><span><b className="block text-[#ff8a3d]">{aiAnalysis.detectedDimensions?.length || 0}</b>cotas detectadas</span><span><b className="block text-[#ff8a3d]">{aiAnalysis.detectedDimensions?.length ? Math.round(aiAnalysis.detectedDimensions.reduce((sum, dimension) => sum + dimension.confidence, 0) / aiAnalysis.detectedDimensions.length * 100) : 0}%</b>confiança das cotas</span></div>
              {aiAnalysis.detectedDimensions?.length > 0 && <div className="mt-2 space-y-1 border-t border-[#29372f] pt-2">{aiAnalysis.detectedDimensions.slice(0, 8).map((dimension, index) => <button key={dimension.id} type="button" onClick={() => setSelectedAiDimension(index)} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[10px] ${selectedAiDimension === index ? "bg-[#3a2a1f]" : "bg-[#18221b]"}`}><span className="text-[#ffb27d]">{dimension.value} {dimension.unit}</span><span className="text-[#aab8b0]">DIMENSION · {Math.round(dimension.confidence * 100)}%</span></button>)}</div>}
              {aiAnalysis.texts.length > 0 && <div className="mt-3 space-y-1 border-t border-[#29372f] pt-2">{aiAnalysis.texts.slice(0, 8).map((text, index) => <div key={`${text.value}-${index}`} className="rounded bg-[#18221b] px-2 py-1.5 text-[10px]"><div className="flex items-center justify-between gap-2"><span className="truncate text-[#e8efeb]">{text.value}</span><span className="shrink-0 text-[#b7f34a]">{Math.round(text.confidence * 100)}%</span></div><div className="mt-0.5 text-[9px] uppercase tracking-wide text-[#829087]">{text.type.replaceAll("_", " ")} · {text.source}</div></div>)}</div>}
              {selectedAiText !== null && aiAnalysis.texts[selectedAiText] && <div className="mt-3 rounded border border-[#3a5140] bg-[#18221b] p-2 text-[10px] leading-4 text-[#c4d0c9]"><b className="text-[#b7f34a]">Texto selecionado</b><br />Valor: {aiAnalysis.texts[selectedAiText].value}<br />Tipo: {aiAnalysis.texts[selectedAiText].type}<br />Confiança: {Math.round(aiAnalysis.texts[selectedAiText].confidence * 100)}%<br />Origem: {aiAnalysis.texts[selectedAiText].source}<br />Posição: {Math.round(aiAnalysis.texts[selectedAiText].position.x)}, {Math.round(aiAnalysis.texts[selectedAiText].position.y)}<div className="mt-2 flex gap-1"><button type="button" onClick={() => setAiTextFeedback("confirmed")} className="flex-1 rounded bg-[#2a4a2d] py-1 text-[9px] font-bold text-[#caffab]">Confirmar</button><button type="button" onClick={() => setAiTextFeedback("rejected")} className="flex-1 rounded bg-[#4a2929] py-1 text-[9px] font-bold text-[#ffb2ac]">Rejeitar</button></div></div>}
              {selectedAiElement !== null && aiAnalysis.elements?.[selectedAiElement] && <div className="mt-3 rounded border border-[#3a5140] bg-[#18221b] p-2 text-[10px] leading-4 text-[#c4d0c9]"><b className="text-[#b7f34a]">Elemento detectado</b><br />Nome: {aiAnalysis.elements[selectedAiElement].name}<br />Tipo: {aiAnalysis.elements[selectedAiElement].type}<br />Confiança: {Math.round(aiAnalysis.elements[selectedAiElement].confidence * 100)}%<br />Origem: {aiAnalysis.elements[selectedAiElement].source}<br />Posição: {Math.round(aiAnalysis.elements[selectedAiElement].position.x)}, {Math.round(aiAnalysis.elements[selectedAiElement].position.y)}<div className="mt-2 flex gap-1"><button type="button" onClick={() => setAiElementFeedback("confirmed")} className="flex-1 rounded bg-[#2a4a2d] py-1 text-[9px] font-bold text-[#caffab]">Confirmar</button><button type="button" onClick={() => setAiElementFeedback("rejected")} className="flex-1 rounded bg-[#4a2929] py-1 text-[9px] font-bold text-[#ffb2ac]">Rejeitar</button></div></div>}
              {selectedAiDimension !== null && aiAnalysis.detectedDimensions?.[selectedAiDimension] && <div className="mt-3 rounded border border-[#5a3822] bg-[#2a1d15] p-2 text-[10px] leading-4 text-[#ffd9bd]"><b className="text-[#ff8a3d]">Cota selecionada</b><br />Valor: {aiAnalysis.detectedDimensions[selectedAiDimension].value} {aiAnalysis.detectedDimensions[selectedAiDimension].unit}<br />Tipo: DIMENSION<br />Origem: {aiAnalysis.detectedDimensions[selectedAiDimension].source}<br />Confiança: {Math.round(aiAnalysis.detectedDimensions[selectedAiDimension].confidence * 100)}%<br />Orientação: {aiAnalysis.detectedDimensions[selectedAiDimension].orientation}</div>}
            </>}
          </div>
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
          <label className="text-[10px] uppercase tracking-wider text-[#77867e]">Modo de processamento</label>
          <div className="grid grid-cols-2 gap-1">
            {([["manual", "Manual"], ["auto", "IA Automática"]] as [LineProcessingMode, string][]).map(([value, label]) => <button key={value} type="button" onClick={() => setLineProcessingMode(value)} className={`rounded-md px-1 py-2 text-[9px] font-bold ${lineProcessingMode === value ? "bg-[#b7f34a] text-[#0c150e]" : "bg-[#18201c] text-[#8f9d95]"}`}>{label}</button>)}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1 border-b border-[#29372f] pb-2 text-center text-[9px] text-[#aab8b0]">
            <span><b className="block text-[#e8efeb]">{lineMetrics.detected}</b>linhas detectadas</span>
            <span><b className="block text-[#b7f34a]">{lineMetrics.kept}</b>linhas mantidas</span>
            <span><b className="block text-[#e8efeb]">{lineMetrics.removed}</b>linhas removidas</span>
            <span><b className="block text-[#b7f34a]">{lineMetrics.unified}</b>linhas unificadas</span>
            <span><b className="block text-[#b7f34a]">{lineMetrics.reductionPercent}%</b>redução</span>
          </div>
          <label className="text-[10px] uppercase tracking-wider text-[#77867e]">Modo de saída</label>
          <div className="grid grid-cols-3 gap-1">{([["pixel", "Original"], ["smooth", "Smooth"], ["cad", "CAD Clean"]] as [OutputMode, string][]).map(([value, label]) => <button key={value} onClick={() => setVector({ ...vector, outputMode: value })} className={`rounded-md px-1 py-2 text-[9px] font-bold ${vector.outputMode === value ? "bg-[#b7f34a] text-[#0c150e]" : "bg-[#18201c] text-[#8f9d95]"}`}>{label}</button>)}</div>
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
            {showAiOverlay && aiAnalysis && <><AiAnalysisOverlay elements={aiAnalysis.elements || []} threshold={aiConfidenceThreshold} selectedIndex={selectedAiElement} onSelect={index => { setSelectedAiElement(index); const selected = aiAnalysis.elements?.[index]; const textIndex = selected ? aiAnalysis.texts.findIndex(text => text.value === selected.name && text.position.x === selected.position.x && text.position.y === selected.position.y) : -1; setSelectedAiText(textIndex >= 0 ? textIndex : null); }} /><DimensionOverlay dimensions={aiAnalysis.detectedDimensions || []} threshold={aiConfidenceThreshold} selectedIndex={selectedAiDimension} onSelect={setSelectedAiDimension} /></>}
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
        <Section title="Resumo do vetor" icon={<Layers3 size={14} />}><Stat label="Caminhos" value={pathCount} /><Stat label="Pontos editáveis" value={pointCount} /><Stat label="Layer principal" value="CONTOURS" /><Stat label="Dimensão" value={`${realWidth} × ${realHeight} ${unit}`} /><Stat label="Redução CAD" value={`${cleanupStats.reductionPercent}%`} /><div className="mt-2 text-[9px] text-[#829087]">Antes: {cleanupStats.beforePoints} pontos · Depois: {cleanupStats.afterPoints} pontos · {cleanupStats.beforePaths} → {cleanupStats.afterPaths} caminhos</div></Section>
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

import type { CadProjectData } from "@/types/project";
import type { DetectedText, Unit, VectorDocument } from "@/types/vector";
import { deduplicateAiTexts, TextFusionEngine } from "@/lib/ai/text-fusion";
import { elementRecognitionEngine, type RecognizedElement } from "@/lib/ai/element-recognition";
import type { VisionDetectedObject, VisionObjectDetectorLike } from "@/lib/ai/vision-object-detector";
import { dimensionRecognitionEngine, type RecognizedDimension } from "@/lib/ai/dimension-recognition";

export type AiDimension = {
  width: number;
  height: number;
  unit: Unit;
  confidence: number;
};

export type AiObject = {
  id: string;
  type: "vector-path" | "text";
  layer?: string;
  confidence: number;
};

export type AiDetectedElement = RecognizedElement;

export type AiTextType = "TEXT" | "ANNOTATION" | "TITLE" | "LABEL" | "POSSIBLE_DIMENSION" | "UNKNOWN" | "ROOM_NAME" | "EQUIPMENT_TAG" | "SCALE" | "NOTE";

export type AiTextElement = {
  value: string;
  type: AiTextType;
  confidence: number;
  position: { x: number; y: number };
  boundingBox: { x: number; y: number; width: number; height: number };
  rotation: number;
  source: "OCR" | "VISION_AI";
};

export type AiFeedback = {
  elementKey: string;
  status: "confirmed" | "rejected" | "corrected";
  correction?: { value?: string; type?: AiTextType };
  createdAt: string;
};

export type VectorCadAiAnalysis = {
  texts: AiTextElement[];
  elements: AiDetectedElement[];
  visionObjects: VisionDetectedObject[];
  objectDetectionStatus: "executed" | "fallback" | "skipped";
  detectedDimensions: RecognizedDimension[];
  dimensions: AiDimension[];
  objects: AiObject[];
  confidence: number;
  provider: string;
  analyzedAt: string;
};

export type VectorCadAiInput = {
  image?: ImageData | null;
  imageDataUrl?: string | null;
  region?: { x: number; y: number; width: number; height: number } | null;
  context?: Record<string, unknown> | null;
  project?: CadProjectData | null;
  vectors?: VectorDocument | null;
  dimensions?: { width: number; height: number; unit: Unit } | null;
  ocrTexts?: DetectedText[];
};

export interface VisionProvider {
  readonly name: string;
  analyze(input: VectorCadAiInput): Promise<Partial<VectorCadAiAnalysis>>;
}

type VisionResponseText = {
  value?: unknown;
  type?: unknown;
  confidence?: unknown;
  position?: unknown;
  boundingBox?: unknown;
  rotation?: unknown;
};

const visionSystemPrompt = "Você é um especialista em interpretação de desenhos CAD e engenharia. Identifique somente textos visíveis em desenhos técnicos: títulos, legendas, anotações e possíveis cotas. Não interprete linhas, símbolos ou geometrias como texto. Retorne somente JSON válido no formato {\\\"texts\\\":[{\\\"value\\\":\\\"...\\\",\\\"type\\\":\\\"TEXT|ANNOTATION|TITLE|LABEL|POSSIBLE_DIMENSION|UNKNOWN\\\",\\\"confidence\\\":0.0,\\\"position\\\":{\\\"x\\\":0,\\\"y\\\":0},\\\"boundingBox\\\":{\\\"x\\\":0,\\\"y\\\":0,\\\"width\\\":0,\\\"height\\\":0},\\\"rotation\\\":0}]}";

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseVisionPayload(value: unknown): AiTextElement[] {
  const payload = typeof value === "string" ? JSON.parse(value) as { texts?: VisionResponseText[] } : value as { texts?: VisionResponseText[] };
  if (!payload || !Array.isArray(payload.texts)) throw new Error("VISION_INVALID_JSON");
  return payload.texts.flatMap((item) => {
    if (typeof item.value !== "string" || !item.value.trim()) return [];
    const position = item.position as { x?: unknown; y?: unknown } | null;
    const box = item.boundingBox as { x?: unknown; y?: unknown; width?: unknown; height?: unknown } | null;
    const type = ["TEXT", "ANNOTATION", "TITLE", "LABEL", "POSSIBLE_DIMENSION", "UNKNOWN", "ROOM_NAME", "EQUIPMENT_TAG", "SCALE", "NOTE"].includes(String(item.type)) ? item.type as AiTextType : "UNKNOWN";
    return [{
      value: item.value.trim(),
      type,
      confidence: Math.max(0, Math.min(1, asNumber(item.confidence))),
      position: { x: asNumber(position?.x), y: asNumber(position?.y) },
      boundingBox: { x: asNumber(box?.x), y: asNumber(box?.y), width: Math.max(0, asNumber(box?.width)), height: Math.max(0, asNumber(box?.height)) },
      rotation: asNumber(item.rotation),
      source: "VISION_AI" as const,
    }];
  });
}

/** Real provider for OpenAI-compatible multimodal APIs. It is only imported by server routes. */
export class RealVisionProvider implements VisionProvider {
  readonly name = "vision-ai";
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly model: string;

  constructor(options: { apiKey?: string; endpoint?: string; model?: string } = {}) {
    this.apiKey = options.apiKey || process.env.VISION_API_KEY || "";
    this.endpoint = options.endpoint || process.env.VISION_API_URL || "https://api.openai.com/v1/chat/completions";
    this.model = options.model || process.env.VISION_MODEL || "gpt-4.1-mini";
  }

  async analyze(input: VectorCadAiInput): Promise<Partial<VectorCadAiAnalysis>> {
    if (!this.apiKey) throw new Error("VISION_API_KEY_MISSING");
    if (!input.imageDataUrl?.startsWith("data:image/")) throw new Error("VISION_IMAGE_MISSING");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: visionSystemPrompt },
            { role: "user", content: [
              { type: "text", text: JSON.stringify({ region: input.region || null, context: input.context || null }) },
              { type: "image_url", image_url: { url: input.imageDataUrl, detail: "high" } },
            ] },
          ],
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`VISION_API_${response.status}`);
      const body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
      const content = body.choices?.[0]?.message?.content;
      const texts = parseVisionPayload(content);
      return { texts, confidence: averageConfidence(texts), provider: this.name };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("VISION_API_TIMEOUT");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function averageConfidence(texts: Array<{ confidence: number }>) {
  return texts.length ? texts.reduce((total, text) => total + text.confidence, 0) / texts.length : 0;
}

function normalizedText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

export function classifyDetectedText(text: DetectedText): AiTextElement {
  const normalized = normalizedText(text.text);
  const hasLetters = /[A-ZÀ-Ý]/.test(normalized);
  const hasNumbers = /\d/.test(normalized);
  const isDimension = /^\d+(?:[.,]\d+)?(?:\s*(?:MM|CM|M))?$/.test(normalized) || /^\d+\s*[X×]\s*\d+$/.test(normalized);
  const isScale = /ESCALA\s*\d+\s*[:/]\s*\d+/.test(normalized);
  const isNote = /^(?:NOTA|OBS(?:ERVAÇÃO|ERVACAO)?)/.test(normalized);
  const isEquipmentTag = /^(?:TAG|PT|FT|LT|PIT|VÁLVULA)[-_ ]?\d+[A-Z0-9-]*$/.test(normalized);
  const isRoomName = /^(?:SALA|BANHEIRO|COZINHA|QUARTO|ESCRITÓRIO|CORREDOR|RECEPÇÃO|ALMOXARIFADO|LABORATÓRIO)(?:\s|$)/.test(normalized) && normalized.split(/\s+/).length > 1;
  const isAnnotation = /(?:NORTE|DETALHE|COTA|NIVEL|REV(?:ISÃO|ISAO)?)/.test(normalized) || /\d+\s*:\s*\d+/.test(normalized);
  const isTitle = /(?:PLANTA|CORTE|FACHADA|LAYOUT|PROJETO|IMPLANTAÇÃO|IMPLANTACAO|DIAGRAMA|MEMORIAL)/.test(normalized) && normalized.split(/\s+/).length >= 2;
  const isLabel = hasLetters && !hasNumbers && normalized.length >= 3;
  const type: AiTextType = isDimension ? "POSSIBLE_DIMENSION" : isScale ? "SCALE" : isNote ? "NOTE" : isEquipmentTag ? "EQUIPMENT_TAG" : isRoomName ? "ROOM_NAME" : isTitle ? "TITLE" : isAnnotation ? "ANNOTATION" : isLabel ? "LABEL" : hasLetters || hasNumbers ? "TEXT" : "UNKNOWN";
  const correctedType: AiTextType = /^[A-Z]{1,3}-\d{2,4}[A-Z0-9-]*$/.test(normalized) ? "EQUIPMENT_TAG" : /^[\u00d8\u2300]\s*\d/.test(normalized) ? "POSSIBLE_DIMENSION" : /^(?:ESCALA\s*)?\d+\s*[:/]\s*\d+$/.test(normalized) ? "SCALE" : type;
  return {
    value: text.text,
    type: correctedType,
    confidence: text.confidence,
    position: { x: text.x, y: text.y },
    boundingBox: { x: text.x, y: text.y, width: text.width, height: text.height },
    rotation: text.rotation,
    source: "OCR",
  };
}

/** Development provider: normalizes local OCR and existing CAD geometry without external AI calls. */
export class MockProvider implements VisionProvider {
  readonly name = "mock-local";

  async analyze(input: VectorCadAiInput): Promise<Partial<VectorCadAiAnalysis>> {
    const ocrTexts = input.ocrTexts || input.project?.detectedTexts || [];
    const texts = ocrTexts.map(classifyDetectedText);
    const vectors = input.vectors || input.project?.document;
    const dimensions = input.dimensions || (input.project?.realWidth && input.project.realHeight && input.project.unit
      ? { width: input.project.realWidth, height: input.project.realHeight, unit: input.project.unit }
      : null);
    return {
      texts,
      dimensions: dimensions ? [{ ...dimensions, confidence: 1 }] : [],
      objects: [
        ...(vectors?.paths || []).map((path, index) => ({ id: `path-${index + 1}`, type: "vector-path" as const, layer: path.layer, confidence: 1 })),
        ...texts.map((text, index) => ({ id: `text-${index + 1}`, type: "text" as const, confidence: text.confidence })),
      ],
      confidence: averageConfidence(texts),
    };
  }
}

export const mockProvider = new MockProvider();

export function consolidateAiTexts(ocrTexts: DetectedText[], visionTexts: AiTextElement[]) {
  return new TextFusionEngine(classifyDetectedText).fuseDetectedTexts(ocrTexts, visionTexts);
}

function nearObject(left: VisionDetectedObject, right: VisionDetectedObject) {
  if (left.type !== right.type) return false;
  return Math.hypot(left.position.x - right.position.x, left.position.y - right.position.y) < 48;
}

function deduplicateVisionObjects(objects: VisionDetectedObject[]) {
  const merged: VisionDetectedObject[] = [];
  for (const candidate of objects) {
    const index = merged.findIndex((object) => nearObject(object, candidate));
    if (index < 0) merged.push(candidate);
    else if (candidate.confidence > merged[index].confidence) merged[index] = candidate;
  }
  return merged;
}

function offsetPoint(point: { x: number; y: number }, region: { x: number; y: number }) {
  return { x: point.x + region.x, y: point.y + region.y };
}

function offsetBox(box: { x: number; y: number; width: number; height: number }, region: { x: number; y: number }) {
  return { ...box, x: box.x + region.x, y: box.y + region.y };
}

/** Moves region-local coordinates back into the original project coordinate system. */
export function offsetAiAnalysis(analysis: VectorCadAiAnalysis, region: { x: number; y: number; width: number; height: number }): VectorCadAiAnalysis {
  return {
    ...analysis,
    texts: analysis.texts.map((text) => ({ ...text, position: offsetPoint(text.position, region), boundingBox: offsetBox(text.boundingBox, region) })),
    elements: analysis.elements.map((element) => ({ ...element, position: offsetPoint(element.position, region), boundingBox: offsetBox(element.boundingBox, region) })),
    visionObjects: analysis.visionObjects.map((object) => ({ ...object, position: offsetPoint(object.position, region), boundingBox: offsetBox(object.boundingBox, region) })),
    detectedDimensions: analysis.detectedDimensions.map((dimension) => ({
      ...dimension,
      position: offsetPoint(dimension.position, region),
      boundingBox: offsetBox(dimension.boundingBox, region),
      startPoint: offsetPoint(dimension.startPoint, region),
      endPoint: offsetPoint(dimension.endPoint, region),
    })),
  };
}

/** Consolidates OCR and one or more Vision responses without losing low-confidence candidates. */
export function mergeAiAnalyses(base: VectorCadAiAnalysis, analyses: VectorCadAiAnalysis[]): VectorCadAiAnalysis {
  const allTexts = [base.texts, ...analyses.map((analysis) => analysis.texts)].flat();
  const texts = deduplicateAiTexts(allTexts);
  const visionObjects = deduplicateVisionObjects([base.visionObjects, ...analyses.map((analysis) => analysis.visionObjects)].flat());
  const elements = elementRecognitionEngine.recognize({ texts, visionObjects, visionAnalysis: { texts } });
  const dimensionUnit = base.dimensions[0]?.unit === "cm" ? "cm" : base.dimensions[0]?.unit === "mm" ? "mm" : undefined;
  const detectedDimensions = dimensionRecognitionEngine.recognize({ texts, elements, visionObjects, unit: dimensionUnit });
  const confidence = texts.length ? averageConfidence(texts) : Math.max(base.confidence, ...analyses.map((analysis) => analysis.confidence), 0);
  return {
    ...base,
    texts,
    elements,
    visionObjects,
    detectedDimensions,
    objectDetectionStatus: [base, ...analyses].some((analysis) => analysis.objectDetectionStatus === "executed") ? "executed" : [base, ...analyses].some((analysis) => analysis.objectDetectionStatus === "fallback") ? "fallback" : "skipped",
    provider: analyses.length ? "hybrid-ocr-vision" : base.provider,
    confidence,
    analyzedAt: new Date().toISOString(),
  };
}

/** Safe diagnostics: coordinates and confidence, never image data or recognized text. */
export function logAiAnalysisDiagnostics(label: string, analysis: VectorCadAiAnalysis) {
  console.info(`[vetorcad][analysis] ${label}`, {
    texts: analysis.texts.length,
    elements: analysis.elements.length,
    dimensions: analysis.detectedDimensions.length,
    confidence: Number(analysis.confidence.toFixed(3)),
    textDiagnostics: analysis.texts.map((text) => ({ type: text.type, source: text.source, confidence: Number(text.confidence.toFixed(3)), rotation: text.rotation, boundingBox: text.boundingBox, valueLength: text.value.length })),
    objectDiagnostics: analysis.visionObjects.map((object) => ({ type: object.type, confidence: Number(object.confidence.toFixed(3)), boundingBox: object.boundingBox })),
  });
}

export async function runVectorCadAi(input: VectorCadAiInput, provider: VisionProvider = mockProvider, objectDetector?: VisionObjectDetectorLike): Promise<VectorCadAiAnalysis> {
  const result = await provider.analyze(input);
  const ocrTexts = input.ocrTexts || input.project?.detectedTexts || [];
  const texts = consolidateAiTexts(ocrTexts, result.texts || []);
  let visionObjects: VisionDetectedObject[] = [];
  let objectDetectionStatus: VectorCadAiAnalysis["objectDetectionStatus"] = objectDetector ? "fallback" : "skipped";
  if (objectDetector && input.imageDataUrl) {
    try {
      visionObjects = await objectDetector.detect({ imageDataUrl: input.imageDataUrl, context: input.context, texts: texts.map(text => ({ value: text.value, position: text.position })) });
      objectDetectionStatus = "executed";
    } catch (error) {
      console.warn("[vetorcad][analysis] detecção visual indisponível", { reason: error instanceof Error ? error.message : "VISION_OBJECT_UNKNOWN_ERROR" });
    }
  }
  const elements = elementRecognitionEngine.recognize({ image: input.image, texts, visionAnalysis: result, visionObjects });
  const dimensionUnit = input.dimensions?.unit === "cm" ? "cm" : input.dimensions?.unit === "mm" ? "mm" : undefined;
  const detectedDimensions = dimensionRecognitionEngine.recognize({ image: input.image, texts, elements, visionObjects, unit: dimensionUnit });
  return {
    texts,
    elements,
    visionObjects,
    objectDetectionStatus,
    detectedDimensions,
    dimensions: result.dimensions || [],
    objects: result.objects || [],
    confidence: Math.max(0, Math.min(1, result.confidence ?? averageConfidence(texts))),
    provider: result.provider || provider.name,
    analyzedAt: new Date().toISOString(),
  };
}

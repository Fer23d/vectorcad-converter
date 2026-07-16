import type { CadProjectData } from "@/types/project";
import type { DetectedText, Unit, VectorDocument } from "@/types/vector";

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

export type AiTextType = "TEXT" | "ANNOTATION" | "TITLE" | "LABEL" | "POSSIBLE_DIMENSION" | "UNKNOWN";

export type AiTextElement = {
  value: string;
  type: AiTextType;
  confidence: number;
  position: { x: number; y: number };
  boundingBox: { x: number; y: number; width: number; height: number };
  rotation: number;
  source: "OCR" | "VisionProvider";
};

export type AiFeedback = {
  elementKey: string;
  status: "confirmed" | "rejected" | "corrected";
  correction?: { value?: string; type?: AiTextType };
  createdAt: string;
};

export type VectorCadAiAnalysis = {
  texts: AiTextElement[];
  dimensions: AiDimension[];
  objects: AiObject[];
  confidence: number;
  provider: string;
  analyzedAt: string;
};

export type VectorCadAiInput = {
  image?: ImageData | null;
  project?: CadProjectData | null;
  vectors?: VectorDocument | null;
  dimensions?: { width: number; height: number; unit: Unit } | null;
  ocrTexts?: DetectedText[];
};

export interface VisionProvider {
  readonly name: string;
  analyze(input: VectorCadAiInput): Promise<Partial<VectorCadAiAnalysis>>;
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
  const isAnnotation = /(?:ESCALA|NORTE|NOTA|OBS(?:ERVAÇÃO|ERVACAO)?|DETALHE|COTA|NIVEL|REV(?:ISÃO|ISAO)?)/.test(normalized) || /\d+\s*:\s*\d+/.test(normalized);
  const isTitle = /(?:PLANTA|CORTE|FACHADA|LAYOUT|PROJETO|IMPLANTAÇÃO|IMPLANTACAO|DIAGRAMA|MEMORIAL)/.test(normalized) && normalized.split(/\s+/).length >= 2;
  const isLabel = hasLetters && !hasNumbers && normalized.length >= 3;
  const type: AiTextType = isDimension ? "POSSIBLE_DIMENSION" : isTitle ? "TITLE" : isAnnotation ? "ANNOTATION" : isLabel ? "LABEL" : hasLetters || hasNumbers ? "TEXT" : "UNKNOWN";
  return {
    value: text.text,
    type,
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

export async function runVectorCadAi(input: VectorCadAiInput, provider: VisionProvider = mockProvider): Promise<VectorCadAiAnalysis> {
  const result = await provider.analyze(input);
  const fallbackTexts = (input.ocrTexts || input.project?.detectedTexts || []).map(classifyDetectedText);
  const texts = result.texts || fallbackTexts;
  return {
    texts,
    dimensions: result.dimensions || [],
    objects: result.objects || [],
    confidence: Math.max(0, Math.min(1, result.confidence ?? averageConfidence(texts))),
    provider: result.provider || provider.name,
    analyzedAt: new Date().toISOString(),
  };
}

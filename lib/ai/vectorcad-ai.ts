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
    const type = ["TEXT", "ANNOTATION", "TITLE", "LABEL", "POSSIBLE_DIMENSION", "UNKNOWN"].includes(String(item.type)) ? item.type as AiTextType : "UNKNOWN";
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

function sameText(left: AiTextElement, right: AiTextElement) {
  const normalizedLeft = normalizedText(left.value).replace(/\s+/g, " ");
  const normalizedRight = normalizedText(right.value).replace(/\s+/g, " ");
  if (Math.hypot(left.position.x - right.position.x, left.position.y - right.position.y) >= 40) return false;
  if (normalizedLeft === normalizedRight) return true;
  const rows = Array.from({ length: normalizedLeft.length + 1 }, (_, row) => {
    const values = new Array<number>(normalizedRight.length + 1).fill(0);
    values[0] = row;
    return values;
  });
  for (let column = 0; column <= normalizedRight.length; column++) rows[0][column] = column;
  for (let row = 1; row <= normalizedLeft.length; row++) {
    for (let column = 1; column <= normalizedRight.length; column++) {
      rows[row][column] = Math.min(rows[row - 1][column] + 1, rows[row][column - 1] + 1, rows[row - 1][column - 1] + (normalizedLeft[row - 1] === normalizedRight[column - 1] ? 0 : 1));
    }
  }
  return rows[normalizedLeft.length][normalizedRight.length] <= Math.max(2, Math.floor(Math.max(normalizedLeft.length, normalizedRight.length) * .2));
}

export function consolidateAiTexts(ocrTexts: DetectedText[], visionTexts: AiTextElement[]) {
  const merged = ocrTexts.map(classifyDetectedText);
  for (const visionText of visionTexts) {
    const duplicateIndex = merged.findIndex((text) => sameText(text, visionText));
    if (duplicateIndex < 0) merged.push(visionText);
    else if (visionText.confidence > merged[duplicateIndex].confidence) merged[duplicateIndex] = visionText;
  }
  return merged;
}

export async function runVectorCadAi(input: VectorCadAiInput, provider: VisionProvider = mockProvider): Promise<VectorCadAiAnalysis> {
  const result = await provider.analyze(input);
  const ocrTexts = input.ocrTexts || input.project?.detectedTexts || [];
  const texts = consolidateAiTexts(ocrTexts, result.texts || []);
  return {
    texts,
    dimensions: result.dimensions || [],
    objects: result.objects || [],
    confidence: Math.max(0, Math.min(1, result.confidence ?? averageConfidence(texts))),
    provider: result.provider || provider.name,
    analyzedAt: new Date().toISOString(),
  };
}

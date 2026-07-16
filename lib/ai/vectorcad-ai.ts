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

export type VectorCadAiAnalysis = {
  texts: DetectedText[];
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

function averageConfidence(texts: DetectedText[]) {
  return texts.length ? texts.reduce((total, text) => total + text.confidence, 0) / texts.length : 0;
}

/** Development provider: normalizes local OCR and existing CAD geometry without external AI calls. */
export class MockProvider implements VisionProvider {
  readonly name = "mock-local";

  async analyze(input: VectorCadAiInput): Promise<Partial<VectorCadAiAnalysis>> {
    const texts = input.ocrTexts || input.project?.detectedTexts || [];
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
  const texts = result.texts || input.ocrTexts || input.project?.detectedTexts || [];
  return {
    texts,
    dimensions: result.dimensions || [],
    objects: result.objects || [],
    confidence: Math.max(0, Math.min(1, result.confidence ?? averageConfidence(texts))),
    provider: result.provider || provider.name,
    analyzedAt: new Date().toISOString(),
  };
}

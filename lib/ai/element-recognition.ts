import type { AiTextElement } from "@/lib/ai/vectorcad-ai";
import type { VisionDetectedObject } from "@/lib/ai/vision-object-detector";

export type RecognizedElementType =
  | "TEXT"
  | "TITLE"
  | "LABEL"
  | "ANNOTATION"
  | "EQUIPMENT"
  | "SYMBOL"
  | "INSTRUMENT"
  | "VALVE"
  | "PUMP"
  | "MOTOR"
  | "PANEL"
  | "TANK"
  | "SENSOR"
  | "CONNECTION"
  | "POSSIBLE_DIMENSION";

export type RecognizedElement = {
  id: string;
  type: RecognizedElementType;
  name: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  position: { x: number; y: number };
  source: "OCR" | "VISION_AI";
};

export type ElementRecognitionInput = {
  image?: ImageData | null;
  texts: AiTextElement[];
  visionAnalysis?: { texts?: AiTextElement[] } | null;
  visionObjects?: VisionDetectedObject[];
};

const supportedTextTypes = new Set<RecognizedElementType>(["TEXT", "TITLE", "LABEL", "ANNOTATION", "POSSIBLE_DIMENSION"]);

function elementType(text: AiTextElement): RecognizedElementType {
  return supportedTextTypes.has(text.type as RecognizedElementType) ? text.type as RecognizedElementType : "TEXT";
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/**
 * Converts the consolidated OCR/Vision text contract into CAD element data.
 * Geometry recognition is intentionally reserved for later providers; this
 * first version never invents equipment or symbols from vector paths.
 */
export class ElementRecognitionEngine {
  recognize(input: ElementRecognitionInput): RecognizedElement[] {
    const texts = input.texts.length ? input.texts : input.visionAnalysis?.texts || [];
    const textElements = texts.map((text, index) => ({
      id: `element-${index + 1}`,
      type: elementType(text),
      name: text.value,
      confidence: clampConfidence(text.confidence),
      boundingBox: { ...text.boundingBox },
      position: { ...text.position },
      source: text.source,
    }));
    const objectElements = (input.visionObjects || []).map((object, index) => ({
      id: object.id || `element-${textElements.length + index + 1}`,
      type: object.type,
      name: object.name,
      confidence: object.confidence,
      boundingBox: { ...object.boundingBox },
      position: { ...object.position },
      source: "VISION_AI" as const,
    }));
    return [...textElements, ...objectElements];
  }
}

export const elementRecognitionEngine = new ElementRecognitionEngine();

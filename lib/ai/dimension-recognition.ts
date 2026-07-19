import type { AiTextElement } from "@/lib/ai/vectorcad-ai";
import type { RecognizedElement } from "@/lib/ai/element-recognition";
import type { VisionDetectedObject } from "@/lib/ai/vision-object-detector";

export type DimensionUnit = "mm" | "cm" | "m";
export type DimensionOrientation = "horizontal" | "vertical" | "aligned";

export type RecognizedDimension = {
  id: string;
  type: "DIMENSION";
  value: number;
  unit: DimensionUnit;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  position: { x: number; y: number };
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  source: "OCR" | "VISION_AI";
  orientation: DimensionOrientation;
};

export type DimensionRecognitionInput = {
  image?: ImageData | null;
  texts: AiTextElement[];
  elements?: RecognizedElement[];
  visionObjects?: VisionDetectedObject[];
  unit?: DimensionUnit;
};

type DimensionEvidence = {
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
};

const dimensionTextTypes = new Set(["POSSIBLE_DIMENSION", "TEXT", "ANNOTATION"]);
const visualEvidenceTypes = new Set(["CONNECTION", "SYMBOL"]);

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalizeNumber(raw: string) {
  const compact = raw.replace(/\s+/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const value = Number(compact);
  return Number.isFinite(value) ? value : null;
}

function parseDimensionText(value: string, fallbackUnit: DimensionUnit): { numericValue: number; unit: DimensionUnit } | null {
  const normalized = value.trim().replace(/×/g, "x");
  if (!normalized || /[A-Za-z]/.test(normalized.replace(/(?:mm|cm|m)$/i, ""))) return null;
  if (/^\d{1,4}[./-]\d{1,2}[./-]\d{1,4}$/.test(normalized)) return null;
  const match = normalized.match(/^(\d[\d\s.,]*?)(?:\s*(mm|cm|m))?$/i);
  if (!match) return null;
  const numericValue = normalizeNumber(match[1]);
  if (numericValue === null || numericValue <= 0) return null;
  return { numericValue, unit: (match[2]?.toLowerCase() as DimensionUnit | undefined) || fallbackUnit };
}

function overlapsOrNear(left: { x: number; y: number; width: number; height: number }, right: { x: number; y: number; width: number; height: number }) {
  const leftRight = left.x + left.width;
  const rightRight = right.x + right.width;
  const leftBottom = left.y + left.height;
  const rightBottom = right.y + right.height;
  const horizontalGap = Math.max(right.x - leftRight, left.x - rightRight, 0);
  const verticalGap = Math.max(right.y - leftBottom, left.y - rightBottom, 0);
  return Math.hypot(horizontalGap, verticalGap) <= Math.max(24, Math.max(left.width, left.height) * 3);
}

function orientationFor(text: AiTextElement): DimensionOrientation {
  const rotation = Math.abs(text.rotation % 180);
  if (rotation < 15 || rotation > 165) return "horizontal";
  if (Math.abs(rotation - 90) < 15) return "vertical";
  return "aligned";
}

function pointsFor(evidence: DimensionEvidence, text: AiTextElement, orientation: DimensionOrientation) {
  if (evidence.startPoint && evidence.endPoint) return { startPoint: evidence.startPoint, endPoint: evidence.endPoint };
  const box = evidence.boundingBox;
  if (orientation === "vertical") {
    const x = box.x + box.width / 2;
    return { startPoint: { x, y: box.y }, endPoint: { x, y: box.y + box.height } };
  }
  if (orientation === "aligned") {
    return { startPoint: { x: box.x, y: box.y + box.height }, endPoint: { x: box.x + box.width, y: box.y } };
  }
  const y = box.y + box.height / 2;
  return { startPoint: { x: box.x, y }, endPoint: { x: box.x + box.width, y } };
}

/** Recognizes dimensions only when numeric text has nearby visual CAD evidence. */
export class DimensionRecognitionEngine {
  recognize(input: DimensionRecognitionInput): RecognizedDimension[] {
    const visualObjects = input.visionObjects || [];
    const recognizedElements = input.elements || [];
    const evidence: DimensionEvidence[] = [
      ...visualObjects.filter(object => visualEvidenceTypes.has(object.type)).map(object => ({ boundingBox: object.boundingBox, confidence: object.confidence })),
      ...recognizedElements.filter(element => visualEvidenceTypes.has(element.type)).map(element => ({ boundingBox: element.boundingBox, confidence: element.confidence })),
    ];
    const fallbackUnit = input.unit || "mm";
    return input.texts.flatMap((text, index) => {
      if (!dimensionTextTypes.has(text.type) || text.type === "LABEL" || text.type === "TITLE") return [];
      const parsed = parseDimensionText(text.value.replace(/^[\u00d8\u2300]\s*/, ""), fallbackUnit);
      if (!parsed) return [];
      const nearby = evidence.find(item => overlapsOrNear(text.boundingBox, item.boundingBox));
      if (!nearby) return [];
      const orientation = orientationFor(text);
      const points = pointsFor(nearby, text, orientation);
      return [{
        id: `dimension-${index + 1}`,
        type: "DIMENSION" as const,
        value: parsed.numericValue,
        unit: parsed.unit,
        confidence: clamp(text.confidence * .65 + nearby.confidence * .35),
        boundingBox: { ...text.boundingBox },
        position: { ...text.position },
        ...points,
        source: "VISION_AI" as const,
        orientation,
      }];
    });
  }
}

export const dimensionRecognitionEngine = new DimensionRecognitionEngine();

import type { AiTextElement } from "@/lib/ai/vectorcad-ai";
import type { DetectedText } from "@/types/vector";

export type FusionOcrText = {
  value: string;
  confidence: number;
  rawConfidence?: number;
  confidenceFinal?: number;
  position: { x: number; y: number };
  boundingBox: { x: number; y: number; width: number; height: number };
  rotation: number;
  source: "OCR";
};

type OcrClassifier = (text: DetectedText) => AiTextElement;

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

export function sameText(left: AiTextElement, right: AiTextElement) {
  if (Math.hypot(left.position.x - right.position.x, left.position.y - right.position.y) >= 40) return false;
  const a = normalized(left.value);
  const b = normalized(right.value);
  if (a === b) return true;
  const rows = Array.from({ length: a.length + 1 }, (_, row) => {
    const values = new Array<number>(b.length + 1).fill(0);
    values[0] = row;
    return values;
  });
  for (let column = 0; column <= b.length; column++) rows[0][column] = column;
  for (let row = 1; row <= a.length; row++) {
    for (let column = 1; column <= b.length; column++) {
      rows[row][column] = Math.min(rows[row - 1][column] + 1, rows[row][column - 1] + 1, rows[row - 1][column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1));
    }
  }
  return rows[a.length][b.length] <= Math.max(2, Math.floor(Math.max(a.length, b.length) * .2));
}

/** Keeps the best candidate when OCR and Vision inspect overlapping regions. */
export function deduplicateAiTexts(texts: AiTextElement[]) {
  const merged: AiTextElement[] = [];
  for (const candidate of texts) {
    const duplicateIndex = merged.findIndex((text) => sameText(text, candidate));
    if (duplicateIndex < 0) {
      merged.push(candidate);
      continue;
    }
    const current = merged[duplicateIndex];
    const candidateWins = candidate.confidence > current.confidence;
    if (candidateWins) merged[duplicateIndex] = candidate;
  }
  return merged;
}

export class TextFusionEngine {
  constructor(private readonly classifyOcr: OcrClassifier) {}

  normalizeOcr(text: FusionOcrText): AiTextElement {
    const classified = this.classifyOcr({
      text: text.value,
      x: text.position.x,
      y: text.position.y,
      width: text.boundingBox.width,
      height: text.boundingBox.height,
      rotation: text.rotation,
      confidence: text.confidence,
      rawConfidence: text.rawConfidence,
      confidenceFinal: text.confidenceFinal,
    });
    return { ...classified, source: "OCR" };
  }

  fuse(ocrTexts: FusionOcrText[], visionTexts: AiTextElement[] = []) {
    return deduplicateAiTexts([
      ...ocrTexts.map((text) => this.normalizeOcr(text)),
      ...visionTexts.map((text) => ({ ...text, source: "VISION_AI" as const })),
    ]);
  }

  fuseDetectedTexts(ocrTexts: DetectedText[], visionTexts: AiTextElement[] = []) {
    return this.fuse(ocrTexts.map((text) => ({
      value: text.text,
      confidence: text.confidenceFinal ?? text.confidence,
      rawConfidence: text.rawConfidence ?? text.confidence,
      confidenceFinal: text.confidenceFinal ?? text.confidence,
      position: { x: text.x, y: text.y },
      boundingBox: { x: text.x, y: text.y, width: text.width, height: text.height },
      rotation: text.rotation,
      source: "OCR" as const,
    })), visionTexts);
  }
}

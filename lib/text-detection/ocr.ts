import type { DetectedText } from "@/types/vector";

function imageDataToCanvas(image: ImageData) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("OCR_CANVAS_UNAVAILABLE");
  context.putImageData(image, 0, 0);
  return canvas;
}

type OcrPageMode = 6 | 7 | 11 | 12;
type OcrRegion = { x: number; y: number; width: number; height: number };

export type TextDetectionResult = {
  texts: DetectedText[];
  regionsAnalyzed: number;
};

function otsuThreshold(gray: Uint8Array) {
  const histogram = new Uint32Array(256);
  for (const value of gray) histogram[value] += 1;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let threshold = 180;
  for (let i = 0; i < 256; i++) {
    backgroundWeight += histogram[i];
    if (!backgroundWeight) continue;
    const foregroundWeight = total - backgroundWeight;
    if (!foregroundWeight) break;
    backgroundSum += i * histogram[i];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = i;
    }
  }
  return Math.max(120, Math.min(220, threshold));
}

/** Creates a high-contrast OCR-only copy. The editor's original/processed images are untouched. */
function prepareOcrImage(image: ImageData) {
  const maxDimension = Math.max(image.width, image.height);
  const scale = Math.min(3, Math.max(1, 1800 / Math.max(1, maxDimension)));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("OCR_CANVAS_UNAVAILABLE");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const sourceCanvas = imageDataToCanvas(image);
  context.drawImage(sourceCanvas, 0, 0, width, height);
  const prepared = context.getImageData(0, 0, width, height);
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = Math.round(prepared.data[p] * .299 + prepared.data[p + 1] * .587 + prepared.data[p + 2] * .114);
  }
  const threshold = otsuThreshold(gray);
  let darkPixels = 0;
  for (let i = 0; i < gray.length; i++) {
    const isDark = gray[i] < threshold;
    if (isDark) darkPixels += 1;
    const p = i * 4;
    const value = isDark ? 0 : 255;
    prepared.data[p] = value;
    prepared.data[p + 1] = value;
    prepared.data[p + 2] = value;
    prepared.data[p + 3] = 255;
  }
  return { image: prepared, scale, darkRatio: darkPixels / Math.max(1, gray.length) };
}

function detectCandidateRegions(image: ImageData): OcrRegion[] {
  const { width, height, data } = image;
  const total = width * height;
  const dark = new Uint8Array(total);
  for (let i = 0; i < total; i++) dark[i] = data[i * 4] < 128 ? 1 : 0;

  // Long CAD lines are removed only from the OCR mask, never from the editor image.
  const lineLength = Math.max(24, Math.floor(Math.min(width, height) * .08));
  for (let y = 0; y < height; y++) {
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const isDark = x < width && dark[y * width + x] === 1;
      if (isDark && start < 0) start = x;
      if ((!isDark || x === width) && start >= 0) {
        if (x - start >= lineLength) for (let i = start; i < x; i++) dark[y * width + i] = 0;
        start = -1;
      }
    }
  }
  for (let x = 0; x < width; x++) {
    let start = -1;
    for (let y = 0; y <= height; y++) {
      const isDark = y < height && dark[y * width + x] === 1;
      if (isDark && start < 0) start = y;
      if ((!isDark || y === height) && start >= 0) {
        if (y - start >= lineLength) for (let i = start; i < y; i++) dark[i * width + x] = 0;
        start = -1;
      }
    }
  }

  const seen = new Uint8Array(total);
  const components: OcrRegion[] = [];
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const startIndex = y * width + x;
    if (!dark[startIndex] || seen[startIndex]) continue;
    const queue = [startIndex];
    seen[startIndex] = 1;
    let minX = x, maxX = x, minY = y, maxY = y, area = 0;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      const cx = index % width, cy = Math.floor(index / width);
      area++;
      minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
      minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const nx = cx + ox, ny = cy + oy;
        const neighbor = ny * width + nx;
        if (nx > 0 && ny > 0 && nx < width - 1 && ny < height - 1 && dark[neighbor] && !seen[neighbor]) {
          seen[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }
    const componentWidth = maxX - minX + 1, componentHeight = maxY - minY + 1;
    if (area >= 3 && componentWidth <= width * .25 && componentHeight <= height * .15) {
      components.push({ x: minX, y: minY, width: componentWidth, height: componentHeight });
    }
  }

  // Join nearby glyph components into word/annotation boxes.
  const groups: OcrRegion[] = [];
  for (const component of components.sort((a, b) => a.y - b.y || a.x - b.x)) {
    const match = groups.find((group) => {
      const pad = Math.max(8, Math.max(group.height, component.height) * 2.5);
      const horizontalGap = Math.max(group.x, component.x) - Math.min(group.x + group.width, component.x + component.width);
      const verticalGap = Math.max(group.y, component.y) - Math.min(group.y + group.height, component.y + component.height);
      return horizontalGap <= pad && verticalGap <= pad;
    });
    if (!match) groups.push({ ...component });
    else {
      const right = Math.max(match.x + match.width, component.x + component.width);
      const bottom = Math.max(match.y + match.height, component.y + component.height);
      match.x = Math.min(match.x, component.x);
      match.y = Math.min(match.y, component.y);
      match.width = right - match.x;
      match.height = bottom - match.y;
    }
  }
  return groups
    .map((region) => ({ x: Math.max(0, region.x - 8), y: Math.max(0, region.y - 8), width: Math.min(width - Math.max(0, region.x - 8), region.width + 16), height: Math.min(height - Math.max(0, region.y - 8), region.height + 16) }))
    .filter((region) => region.width >= 12 && region.height >= 8 && region.width * region.height <= width * height * .2)
    .slice(0, 80);
}

function cropRegion(image: ImageData, region: OcrRegion) {
  const canvas = imageDataToCanvas(image);
  const crop = document.createElement("canvas");
  crop.width = region.width;
  crop.height = region.height;
  const context = crop.getContext("2d");
  if (!context) throw new Error("OCR_CANVAS_UNAVAILABLE");
  context.drawImage(canvas, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
  return crop;
}

function extractWords(data: { blocks: Array<{ paragraphs: Array<{ lines: Array<{ words: Array<{ text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }> }> }> }> | null }) {
  return (data.blocks || [])
    .flatMap((block) => block.paragraphs)
    .flatMap((paragraph) => paragraph.lines)
    .flatMap((line) => line.words);
}

/** Runs OCR only when requested, keeping the heavy language model out of initial page load. */
export async function detectText(image: ImageData): Promise<TextDetectionResult> {
  if (typeof document === "undefined") throw new Error("OCR_BROWSER_REQUIRED");
  const prepared = prepareOcrImage(image);
  const regions = detectCandidateRegions(prepared.image);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por+eng", 1);
  try {
    const detected: DetectedText[] = [];
    for (const [index, region] of regions.entries()) {
      const pageMode: OcrPageMode = region.width / region.height > 3 ? 7 : index % 3 === 1 ? 11 : index % 3 === 2 ? 12 : 6;
      await worker.setParameters({ tessedit_pageseg_mode: String(pageMode) as never });
      const { data } = await worker.recognize(cropRegion(prepared.image, region));
      for (const word of extractWords(data)) {
        const text = word.text.trim();
        const value = { text, x: (region.x + word.bbox.x0) / prepared.scale, y: (region.y + word.bbox.y0) / prepared.scale, width: (word.bbox.x1 - word.bbox.x0) / prepared.scale, height: (word.bbox.y1 - word.bbox.y0) / prepared.scale, rotation: 0, confidence: word.confidence / 100 };
        if (text.length > 0 && value.width > 1 && value.height > 1 && value.confidence >= .35) detected.push(value);
      }
    }
    const unique = detected.filter((word, index, values) => values.findIndex((candidate) => candidate.text === word.text && Math.abs(candidate.x - word.x) < 2 && Math.abs(candidate.y - word.y) < 2) === index);
    const confidence = unique.length ? unique.reduce((total, word) => total + word.confidence, 0) / unique.length : 0;
    console.info("[VectorCAD][OCR]", {
      regionsAnalyzed: regions.length,
      textsFound: unique.length,
      averageConfidence: Number(confidence.toFixed(3)),
      imageWidth: prepared.image.width,
      imageHeight: prepared.image.height,
      cropSizes: regions.map(({ width, height }) => `${width}x${height}`),
    });
    return { texts: unique, regionsAnalyzed: regions.length };
  } finally {
    await worker.terminate();
  }
}

/** Removes OCR regions from the bitmap so text is not converted into CAD polylines. */
export function protectTextRegions(bitmap: Uint8Array, width: number, height: number, regions: DetectedText[], margin = 1) {
  const protectedBitmap = new Uint8Array(bitmap);
  for (const region of regions) {
    const left = Math.max(0, Math.floor(region.x - margin));
    const top = Math.max(0, Math.floor(region.y - margin));
    const right = Math.min(width, Math.ceil(region.x + region.width + margin));
    const bottom = Math.min(height, Math.ceil(region.y + region.height + margin));
    for (let y = top; y < bottom; y++) protectedBitmap.fill(0, y * width + left, y * width + right);
  }
  return protectedBitmap;
}

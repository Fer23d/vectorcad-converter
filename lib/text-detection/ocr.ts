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

type OcrPageMode = 6 | 11 | 12;

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

function choosePageMode(darkRatio: number): OcrPageMode {
  if (darkRatio > .3) return 6;
  if (darkRatio < .04) return 12;
  return 11;
}

/** Runs OCR only when requested, keeping the heavy language model out of initial page load. */
export async function detectText(image: ImageData): Promise<DetectedText[]> {
  if (typeof document === "undefined") throw new Error("OCR_BROWSER_REQUIRED");
  const prepared = prepareOcrImage(image);
  const pageMode = choosePageMode(prepared.darkRatio);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por+eng", 1);
  try {
    await worker.setParameters({ tessedit_pageseg_mode: String(pageMode) as never });
    const { data } = await worker.recognize(imageDataToCanvas(prepared.image));
    const words = (data.blocks || [])
      .flatMap((block) => block.paragraphs)
      .flatMap((paragraph) => paragraph.lines)
      .flatMap((line) => line.words);
    const detected = words
      .map((word) => ({
        text: word.text.trim(),
        x: word.bbox.x0 / prepared.scale,
        y: word.bbox.y0 / prepared.scale,
        width: (word.bbox.x1 - word.bbox.x0) / prepared.scale,
        height: (word.bbox.y1 - word.bbox.y0) / prepared.scale,
        rotation: 0,
        confidence: word.confidence / 100,
      }))
      .filter((word) => word.text.length > 0 && word.width > 1 && word.height > 1 && word.confidence >= .35);
    const confidence = detected.length ? detected.reduce((total, word) => total + word.confidence, 0) / detected.length : 0;
    console.info("[VectorCAD][OCR]", {
      textsFound: detected.length,
      averageConfidence: Number(confidence.toFixed(3)),
      imageWidth: prepared.image.width,
      imageHeight: prepared.image.height,
      pageMode,
    });
    return detected;
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

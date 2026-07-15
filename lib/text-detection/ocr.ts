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

/** Runs OCR only when requested, keeping the heavy language model out of initial page load. */
export async function detectText(image: ImageData): Promise<DetectedText[]> {
  if (typeof document === "undefined") throw new Error("OCR_BROWSER_REQUIRED");
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por+eng", 1);
  try {
    const { data } = await worker.recognize(imageDataToCanvas(image));
    const words = (data.blocks || [])
      .flatMap((block) => block.paragraphs)
      .flatMap((paragraph) => paragraph.lines)
      .flatMap((line) => line.words);
    return words
      .map((word) => ({
        text: word.text.trim(),
        x: word.bbox.x0,
        y: word.bbox.y0,
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0,
        rotation: 0,
        confidence: word.confidence / 100,
      }))
      .filter((word) => word.text.length > 0 && word.width > 1 && word.height > 1 && word.confidence >= .35);
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

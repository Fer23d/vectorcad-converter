import { boxBlur, closeBinary, openBinary, removeSmallComponents } from "@/lib/image-processing/binary";
import type { ProcessingSettings } from "@/types/vector";

function localMean(gray: Uint8Array, width: number, height: number, x: number, y: number, radius: number) {
  let sum = 0, count = 0;
  for (let oy = -radius; oy <= radius; oy++) for (let ox = -radius; ox <= radius; ox++) {
    const nx = x + ox, ny = y + oy;
    if (nx >= 0 && ny >= 0 && nx < width && ny < height) { sum += gray[ny * width + nx]; count++; }
  }
  return sum / count;
}

export function processPixels(image: ImageData, settings: ProcessingSettings): { image: ImageData; bitmap: Uint8Array; darkRatio: number } {
  const out = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  let gray = new Uint8Array(image.width * image.height);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    let value = out.data[p] * .299 + out.data[p + 1] * .587 + out.data[p + 2] * .114;
    value = (value - 128) * settings.contrast / 100 + 128 + settings.brightness;
    gray[i] = Math.max(0, Math.min(255, value));
  }
  gray = boxBlur(gray, image.width, image.height, settings.blurRadius);
  let bitmap = new Uint8Array(gray.length);
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const i = y * image.width + x;
    let value = gray[i];
    if (settings.edgeDetect && x && y) value = Math.min(255, Math.abs(value - gray[i - 1]) + Math.abs(value - gray[i - image.width]) * 2);
    const threshold = settings.adaptiveThreshold ? localMean(gray, image.width, image.height, x, y, 7) - Math.max(2, (255 - settings.threshold) * .1) : settings.threshold;
    bitmap[i] = (settings.edgeDetect ? value > threshold : settings.invert ? value > threshold : value < threshold) ? 1 : 0;
  }
  if (settings.morphologyRadius > 0) bitmap = closeBinary(bitmap, image.width, image.height, settings.morphologyRadius);
  if (settings.openingRadius > 0) bitmap = openBinary(bitmap, image.width, image.height, settings.openingRadius);
  if (settings.removeNoise) bitmap = removeSmallComponents(bitmap, image.width, image.height, settings.minComponentArea);

  let dark = 0;
  for (let i = 0; i < bitmap.length; i++) {
    if (bitmap[i]) dark++;
    const c = bitmap[i] ? 18 : 255, p = i * 4;
    out.data[p] = out.data[p + 1] = out.data[p + 2] = c;
    out.data[p + 3] = bitmap[i] ? 255 : 0;
  }
  return { image: out, bitmap, darkRatio: dark / bitmap.length };
}

export function removeIsolated(data: Uint8Array, width: number, height: number) {
  const cleaned = removeSmallComponents(data, width, height, 2);
  data.set(cleaned);
  return data;
}

import { boxBlur, closeBinary, openBinary, removeSmallComponents } from "@/lib/image-processing/binary";
import type { ProcessingSettings } from "@/types/vector";
import type { ImageQuality } from "@/types/vector";

function clamp(value: number) {
  return Math.max(0, Math.min(255, value));
}

function isTechnicalDrawing(image: ImageData) {
  const step = Math.max(1, Math.floor(Math.sqrt((image.width * image.height) / 10_000)));
  let samples = 0;
  let bright = 0;
  let dark = 0;
  let chromatic = 0;
  for (let y = 0; y < image.height; y += step) for (let x = 0; x < image.width; x += step) {
    const p = (y * image.width + x) * 4;
    const red = image.data[p], green = image.data[p + 1], blue = image.data[p + 2];
    const gray = red * .299 + green * .587 + blue * .114;
    samples++;
    if (gray >= 225) bright++;
    if (gray <= 90) dark++;
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 24) chromatic++;
  }
  return samples > 0 && bright / samples >= .35 && chromatic / samples < .18 && dark / samples > .001;
}

/** Enhances the image before thresholding without changing its dimensions. */
export function enhanceForCad(image: ImageData, quality: ImageQuality): ImageData {
  if (quality === "original") return new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  const out = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  const technical = isTechnicalDrawing(image);
  const ultraPro = quality === "ultra-pro" && technical;
  const contrast = quality === "ultra" ? 1.7 : ultraPro ? 1.35 : 1.28;
  const gray = ultraPro ? new Uint8Array(image.width * image.height) : null;
  const background = ultraPro ? boxBlur(grayFromImage(image), image.width, image.height, 2) : null;

  for (let p = 0; p < out.data.length; p += 4) {
    const alpha = out.data[p + 3];
    if (technical) {
      const sourceGray = out.data[p] * .299 + out.data[p + 1] * .587 + out.data[p + 2] * .114;
      const shadowCorrected = ultraPro ? clamp(255 + (sourceGray - (background?.[p / 4] || 255)) * 2.1) : sourceGray;
      const value = quality === "ultra" || ultraPro
        ? shadowCorrected >= (ultraPro ? 232 : 224) ? 255 : shadowCorrected <= (ultraPro ? 92 : 82) ? 0 : clamp((shadowCorrected - 128) * contrast + 128)
        : clamp((shadowCorrected - 128) * contrast + 128);
      if (gray) gray[p / 4] = value;
      out.data[p] = out.data[p + 1] = out.data[p + 2] = value;
    } else {
      for (let channel = 0; channel < 3; channel++) out.data[p + channel] = clamp((out.data[p + channel] - 128) * (quality === "ultra" ? 1.15 : 1.05) + 128);
    }
    out.data[p + 3] = alpha;
  }
  if (gray && background) {
    // Remove only isolated dark pixels; connected one-pixel lines remain intact.
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      const index = y * image.width + x;
      if (gray[index] >= 110) continue;
      let darkNeighbors = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const nx = x + ox, ny = y + oy;
        if (nx >= 0 && ny >= 0 && nx < image.width && ny < image.height && gray[ny * image.width + nx] < 150) darkNeighbors++;
      }
      if (darkNeighbors === 0) {
        const p = index * 4;
        out.data[p] = out.data[p + 1] = out.data[p + 2] = 255;
      }
    }
  }
  return out;
}

function grayFromImage(image: ImageData) {
  const gray = new Uint8Array(image.width * image.height);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = Math.round(image.data[p] * .299 + image.data[p + 1] * .587 + image.data[p + 2] * .114);
  }
  return gray;
}

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

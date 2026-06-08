import type { ProcessingSettings } from "@/types/vector";

export function processPixels(image: ImageData, settings: ProcessingSettings): { image: ImageData; bitmap: Uint8Array; darkRatio: number } {
  const out = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  const gray = new Uint8Array(image.width * image.height);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    let value = out.data[p] * .299 + out.data[p + 1] * .587 + out.data[p + 2] * .114;
    value = (value - 128) * settings.contrast / 100 + 128 + settings.brightness;
    gray[i] = Math.max(0, Math.min(255, value));
  }
  if (settings.smooth) {
    const copy = gray.slice();
    for (let y = 1; y < image.height - 1; y++) for (let x = 1; x < image.width - 1; x++) {
      let sum = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) sum += copy[(y + oy) * image.width + x + ox];
      gray[y * image.width + x] = sum / 9;
    }
  }
  const bitmap = new Uint8Array(gray.length);
  let dark = 0;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const i = y * image.width + x;
    let value = gray[i];
    if (settings.edgeDetect && x && y) value = Math.min(255, Math.abs(value - gray[i - 1]) + Math.abs(value - gray[i - image.width]) * 2);
    const isDark = settings.edgeDetect ? value > settings.threshold : settings.invert ? value > settings.threshold : value < settings.threshold;
    bitmap[i] = isDark ? 1 : 0;
    if (isDark) dark++;
    const c = isDark ? 18 : 255, p = i * 4;
    out.data[p] = out.data[p + 1] = out.data[p + 2] = c; out.data[p + 3] = isDark ? 255 : 0;
  }
  if (settings.removeNoise) removeIsolated(bitmap, image.width, image.height);
  return { image: out, bitmap, darkRatio: dark / gray.length };
}

export function removeIsolated(data: Uint8Array, width: number, height: number) {
  const copy = data.slice();
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    if (!copy[i]) continue;
    let neighbors = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if ((ox || oy) && copy[i + oy * width + ox]) neighbors++;
    if (neighbors <= 1) data[i] = 0;
  }
  return data;
}

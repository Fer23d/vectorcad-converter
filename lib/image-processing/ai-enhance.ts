import type { ImageQuality } from "@/types/vector";

export type AiEnhanceMode = "ai-enhance-3k" | "ai-enhance-4k";

export type AiEnhanceMetrics = {
  originalWidth: number;
  originalHeight: number;
  finalWidth: number;
  finalHeight: number;
  scale: number;
  processingMs: number;
  noiseReduced: number;
  contrastApplied: number;
};

export type AiEnhanceResult = {
  image: ImageData;
  metrics: AiEnhanceMetrics;
};

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function luminance(data: Uint8ClampedArray, offset: number) {
  return data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
}

function targetSize(width: number, height: number, maxDimension: number) {
  const scale = maxDimension / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * CAD-oriented raster enhancement. This is deliberately deterministic and local:
 * it enlarges the working raster, preserves geometry, and improves line contrast
 * without changing the original project image or adding artistic hallucinations.
 */
export function processAiEnhance(input: ImageData, mode: AiEnhanceMode): AiEnhanceResult {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const maxDimension = mode === "ai-enhance-4k" ? 4000 : 3000;
  const size = targetSize(input.width, input.height, maxDimension);
  const output = new ImageData(size.width, size.height);
  const source = input.data;
  const contrast = mode === "ai-enhance-4k" ? 1.22 : 1.14;
  const sharpen = mode === "ai-enhance-4k" ? 0.34 : 0.24;
  let contrastApplied = 0;
  let noiseReduced = 0;

  for (let y = 0; y < size.height; y++) {
    const sourceY = ((y + 0.5) * input.height / size.height) - 0.5;
    const y0 = Math.max(0, Math.floor(sourceY));
    const y1 = Math.min(input.height - 1, y0 + 1);
    const fy = Math.max(0, sourceY - y0);
    for (let x = 0; x < size.width; x++) {
      const sourceX = ((x + 0.5) * input.width / size.width) - 0.5;
      const x0 = Math.max(0, Math.floor(sourceX));
      const x1 = Math.min(input.width - 1, x0 + 1);
      const fx = Math.max(0, sourceX - x0);
      const top = (y0 * input.width + x0) * 4;
      const topRight = (y0 * input.width + x1) * 4;
      const bottom = (y1 * input.width + x0) * 4;
      const bottomRight = (y1 * input.width + x1) * 4;
      const offset = (y * size.width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const a = source[top + channel] * (1 - fx) + source[topRight + channel] * fx;
        const b = source[bottom + channel] * (1 - fx) + source[bottomRight + channel] * fx;
        output.data[offset + channel] = clamp(a * (1 - fy) + b * fy);
      }
      output.data[offset + 3] = 255;
    }
  }

  // A small unsharp/contrast pass preserves dark CAD strokes while keeping paper white.
  const enhanced = new Uint8ClampedArray(output.data);
  for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) {
    const index = y * size.width + x;
    const offset = index * 4;
    const center = luminance(output.data, offset);
    let neighborhood = 0;
    let count = 0;
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = x + ox;
      const ny = y + oy;
      if (nx >= 0 && ny >= 0 && nx < size.width && ny < size.height) {
        neighborhood += luminance(output.data, (ny * size.width + nx) * 4);
        count++;
      }
    }
    const average = count ? neighborhood / count : center;
    const detail = center - average;
    const corrected = (center - 128) * contrast + 128 + detail * sharpen;
    const value = clamp(corrected);
    contrastApplied += Math.abs(value - center);
    if (center < 245 && value > 245 && Math.abs(detail) < 5) noiseReduced++;
    enhanced[offset] = enhanced[offset + 1] = enhanced[offset + 2] = value;
    enhanced[offset + 3] = output.data[offset + 3];
  }
  output.data.set(enhanced);

  const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    image: output,
    metrics: {
      originalWidth: input.width,
      originalHeight: input.height,
      finalWidth: size.width,
      finalHeight: size.height,
      scale: Math.max(size.width / input.width, size.height / input.height),
      processingMs: Math.max(0, Math.round(ended - started)),
      noiseReduced,
      contrastApplied: input.width * input.height ? Math.round(contrastApplied / (size.width * size.height)) : 0,
    },
  };
}

export function isAiEnhanceQuality(quality: ImageQuality): quality is AiEnhanceMode {
  return quality === "ai-enhance-3k" || quality === "ai-enhance-4k";
}

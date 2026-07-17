import { closeBinary } from "@/lib/image-processing/binary";

export type CadCleanMetrics = {
  pixelsProcessed: number;
  noiseRemoved: number;
  contrastApplied: number;
};

export type CadCleanResult = {
  image: ImageData;
  metrics: CadCleanMetrics;
};

function luminance(red: number, green: number, blue: number) {
  return red * .299 + green * .587 + blue * .114;
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function localMean(gray: Uint8Array, width: number, height: number, x: number, y: number) {
  let sum = 0;
  let count = 0;
  for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
    const nx = x + ox;
    const ny = y + oy;
    if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
      sum += gray[ny * width + nx];
      count++;
    }
  }
  return sum / count;
}

/** Converts a raster into a clean high-contrast technical drawing without resizing it. */
export function processCadCleanImage(input: ImageData): CadCleanResult {
  const { width, height } = input;
  const pixels = width * height;
  const gray = new Uint8Array(pixels);
  const binary = new Uint8Array(pixels);
  let contrastDelta = 0;

  for (let index = 0; index < pixels; index++) {
    const offset = index * 4;
    gray[index] = clamp(luminance(input.data[offset], input.data[offset + 1], input.data[offset + 2]));
  }

  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x;
    const mean = localMean(gray, width, height, x, y);
    // A local threshold handles scanner shadows while retaining fine dark strokes.
    const threshold = Math.max(105, mean - 28);
    binary[index] = gray[index] < threshold ? 1 : 0;
  }

  let noiseRemoved = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x;
    if (!binary[index]) continue;
    let neighbors = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = x + ox;
      const ny = y + oy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && binary[ny * width + nx]) neighbors++;
    }
    if (neighbors === 0) { binary[index] = 0; noiseRemoved++; }
  }

  const closed = closeBinary(binary, width, height, 1);
  const output = new ImageData(new Uint8ClampedArray(input.data), width, height);
  for (let index = 0; index < pixels; index++) {
    const offset = index * 4;
    const value = closed[index] ? 0 : 255;
    contrastDelta += Math.abs(value - gray[index]);
    output.data[offset] = value;
    output.data[offset + 1] = value;
    output.data[offset + 2] = value;
    output.data[offset + 3] = 255;
  }

  return {
    image: output,
    metrics: {
      pixelsProcessed: pixels,
      noiseRemoved,
      contrastApplied: pixels ? Math.round(contrastDelta / pixels) : 0,
    },
  };
}

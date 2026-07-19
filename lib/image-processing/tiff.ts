import UTIF from "utif";

export const TIFF_MIME_TYPES = ["image/tiff", "image/x-tiff"] as const;
// Allows large scanned drawings such as 12,384 x 7,283 (about 90 MP) while
// keeping a guard against allocations that would exhaust the browser.
export const TIFF_MAX_PIXELS = 100_000_000;

export function isTiffFile(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();
  return TIFF_MIME_TYPES.includes(file.type as (typeof TIFF_MIME_TYPES)[number]) || extension === "tif" || extension === "tiff";
}

export type TiffRaster = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type ProcessedTiff = {
  width: number;
  height: number;
  rgbaData: Uint8ClampedArray;
  previewPng: string;
};

function isBigTiff(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4));
  return bytes.length === 4 && ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2b && bytes[3] === 0x00) || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2b));
}

/** Creates the lossless PNG used by Canvas while keeping the TIFF bytes separate in the project. */
export function rasterToPngDataUrl(raster: TiffRaster) {
  if (typeof document === "undefined") throw new Error("TIFF_CANVAS_UNAVAILABLE");
  const canvas = document.createElement("canvas");
  canvas.width = raster.width;
  canvas.height = raster.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("TIFF_CANVAS_UNAVAILABLE");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, raster.width, raster.height);
  const image = context.createImageData(raster.width, raster.height);
  image.data.set(raster.data);
  // Composite declared transparency over white before encoding. This keeps
  // technical drawings readable and prevents transparent pixels from becoming black in Canvas.
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const alpha = image.data[offset + 3];
    if (alpha === 255) continue;
    image.data[offset] = Math.round((image.data[offset] * alpha + 255 * (255 - alpha)) / 255);
    image.data[offset + 1] = Math.round((image.data[offset + 1] * alpha + 255 * (255 - alpha)) / 255);
    image.data[offset + 2] = Math.round((image.data[offset + 2] * alpha + 255 * (255 - alpha)) / 255);
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function normalizeRgba(rgba: ArrayLike<number>, frame: { t258?: number[]; t277?: number[]; t338?: number[] }, width: number, height: number) {
  const expectedBytes = width * height * 4;
  if (rgba.length !== expectedBytes) throw new Error("TIFF_RGBA_SIZE_INVALID");

  const normalized = new Uint8ClampedArray(rgba);
  // Four channels do not necessarily mean RGBA (CMYK and some RGB encoders also use four).
  // Only ExtraSamples explicitly declares an alpha channel.
  const explicitAlpha = Boolean(frame.t338?.length);
  let hasVisibleAlpha = false;
  for (let i = 3; i < normalized.length; i += 4) {
    if (normalized[i] > 0) {
      hasVisibleAlpha = true;
      break;
    }
  }

  // TIFFs without an alpha channel must remain opaque; otherwise Canvas can display them as black.
  if (!explicitAlpha || !hasVisibleAlpha) {
    for (let i = 3; i < normalized.length; i += 4) normalized[i] = 255;
  }
  return normalized;
}

function decodeOneBit(frame: { data?: Uint8Array; t320?: number[]; t266?: number[] }, width: number, height: number, photometric: number) {
  if (!frame.data) throw new Error("TIFF_PIXEL_DATA_MISSING");
  const palette = frame.t320 || [];
  const paletteSize = Math.floor(palette.length / 3);
  if (photometric === 3 && paletteSize < 2) throw new Error("TIFF_PALETTE_MISSING");

  const rgba = new Uint8ClampedArray(width * height * 4);
  const rowBytes = Math.ceil(width / 8);
  const fillOrder = frame.t266?.[0] || 1;
  const paletteValue = (channel: number, index: number) => {
    const value = palette[channel * paletteSize + index] || 0;
    return value > 255 ? value >> 8 : value;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const packed = frame.data[y * rowBytes + (x >> 3)] || 0;
      const shift = fillOrder === 2 ? x & 7 : 7 - (x & 7);
      const paletteIndex = (packed >> shift) & 1;
      const color = photometric === 3
        ? ((paletteValue(0, paletteIndex) * 0.299 + paletteValue(1, paletteIndex) * 0.587 + paletteValue(2, paletteIndex) * 0.114) < 128 ? 0 : 255)
        : (photometric === 0 ? (paletteIndex ? 0 : 255) : (paletteIndex ? 255 : 0));
      const offset = (y * width + x) * 4;
      rgba[offset] = color;
      rgba[offset + 1] = color;
      rgba[offset + 2] = color;
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

/** Decodes the first TIFF page directly to RGBA pixels for the existing raster pipeline. */
export function decodeTiff(buffer: ArrayBuffer): TiffRaster {
  if (isBigTiff(buffer)) throw new Error("TIFF_BIGTIFF_UNSUPPORTED");
  const frames = UTIF.decode(buffer);
  const frame = frames.find((candidate) => {
    const width = candidate.t256?.[0] || 0;
    const height = candidate.t257?.[0] || 0;
    return width > 0 && height > 0;
  });

  if (!frame) {
    throw new Error("TIFF_DIMENSIONS_UNSUPPORTED");
  }

  const width = frame.t256?.[0] || 0;
  const height = frame.t257?.[0] || 0;
  if (width * height > TIFF_MAX_PIXELS) throw new Error("TIFF_DIMENSIONS_UNSUPPORTED");
  console.info("[vetorcad][TIFF] metadata", {
    width,
    height,
    bitsPerSample: frame.t258 || [],
    samplesPerPixel: frame.t277?.[0] || frame.t258?.length || 1,
    photometric: frame.t262?.[0] ?? null,
    compression: frame.t259?.[0] ?? 1,
    planarConfiguration: frame.t284?.[0] ?? 1,
    sampleFormat: frame.t339 || [],
    orientation: frame.t274?.[0] ?? 1,
    ifdCount: frames.length,
    strips: frame.t273?.length || frame.t324?.length || 0,
    tiles: frame.t322?.length || 0,
  });

  try {
    UTIF.decodeImage(buffer, frame);
    const bitsPerSample = frame.t258?.[0] || 0;
    const samplesPerPixel = frame.t277?.[0] || frame.t258?.length || 1;
    const photometric = frame.t262?.[0] ?? 0;
    const compression = frame.t259?.[0] ?? 1;
    const isOneBitWhiteIsZeroCcitt = compression === 4 && bitsPerSample === 1 && samplesPerPixel === 1 && photometric === 0;
    const isOneBitRaster = bitsPerSample === 1 && samplesPerPixel === 1 && photometric >= 0 && photometric <= 3;
    const rgba = isOneBitWhiteIsZeroCcitt || isOneBitRaster
      ? decodeOneBit(frame, frame.width || width, frame.height || height, photometric)
      : UTIF.toRGBA8(frame);
    const normalized = normalizeRgba(rgba, frame, frame.width || width, frame.height || height);
    console.info("[vetorcad][TIFF] RGBA output", { rgbaBytes: normalized.length });
    return { width: frame.width || width, height: frame.height || height, data: normalized };
  } catch (error) {
    console.error("[vetorcad][TIFF] decode failed", { error: error instanceof Error ? error.message : "unknown_error" });
    throw new Error("TIFF_DECODE_FAILED");
  }
}

/** Processes any supported TIFF into the stable RGBA + PNG contract used by the editor. */
export async function processTiff(buffer: ArrayBuffer): Promise<ProcessedTiff> {
  const raster = decodeTiff(buffer);
  return {
    width: raster.width,
    height: raster.height,
    rgbaData: raster.data,
    previewPng: rasterToPngDataUrl(raster),
  };
}

export async function decodeTiffFile(file: File) {
  return decodeTiff(await file.arrayBuffer());
}

export async function decodeTiffDataUrl(dataUrl: string) {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("TIFF_DATA_UNAVAILABLE");
  return decodeTiff(await response.arrayBuffer());
}

import UTIF from "utif";

export const TIFF_MIME_TYPES = ["image/tiff", "image/x-tiff"] as const;
export const TIFF_MAX_PIXELS = 40_000_000;

export function isTiffFile(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();
  return TIFF_MIME_TYPES.includes(file.type as (typeof TIFF_MIME_TYPES)[number]) || extension === "tif" || extension === "tiff";
}

export type TiffRaster = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

function normalizeRgba(rgba: Uint8Array, frame: { t258?: number[]; t277?: number[]; t338?: number[] }, width: number, height: number) {
  const expectedBytes = width * height * 4;
  if (rgba.length !== expectedBytes) throw new Error("TIFF_RGBA_SIZE_INVALID");

  const normalized = new Uint8ClampedArray(rgba);
  const samplesPerPixel = frame.t277?.[0] || frame.t258?.length || 1;
  const explicitAlpha = Boolean(frame.t338?.length) || samplesPerPixel >= 4;
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

/** Decodes the first TIFF page directly to RGBA pixels for the existing raster pipeline. */
export function decodeTiff(buffer: ArrayBuffer): TiffRaster {
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
  console.info("[VectorCAD][TIFF] metadata", {
    width,
    height,
    bitsPerSample: frame.t258 || [],
    samplesPerPixel: frame.t277?.[0] || frame.t258?.length || 1,
    photometric: frame.t262?.[0] ?? null,
    orientation: frame.t274?.[0] ?? 1,
    ifdCount: frames.length,
  });

  try {
    UTIF.decodeImage(buffer, frame);
    const rgba = UTIF.toRGBA8(frame);
    const normalized = normalizeRgba(rgba, frame, frame.width || width, frame.height || height);
    console.info("[VectorCAD][TIFF] RGBA output", { rgbaBytes: normalized.length });
    return { width: frame.width || width, height: frame.height || height, data: normalized };
  } catch (error) {
    console.error("[VectorCAD][TIFF] decode failed", { error: error instanceof Error ? error.message : "unknown_error" });
    throw new Error("TIFF_DECODE_FAILED");
  }
}

export async function decodeTiffFile(file: File) {
  return decodeTiff(await file.arrayBuffer());
}

export async function decodeTiffDataUrl(dataUrl: string) {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("TIFF_DATA_UNAVAILABLE");
  return decodeTiff(await response.arrayBuffer());
}

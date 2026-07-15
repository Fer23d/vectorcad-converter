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

/** Decodes the first TIFF page directly to RGBA pixels for the existing raster pipeline. */
export function decodeTiff(buffer: ArrayBuffer): TiffRaster {
  const frames = UTIF.decode(buffer);
  const frame = frames[0];

  if (!frame?.width || !frame.height || frame.width * frame.height > TIFF_MAX_PIXELS) {
    throw new Error("TIFF_DIMENSIONS_UNSUPPORTED");
  }

  UTIF.decodeImage(buffer, frame);
  const rgba = UTIF.toRGBA8(frame);
  return { width: frame.width, height: frame.height, data: new Uint8ClampedArray(rgba) };
}

export async function decodeTiffFile(file: File) {
  return decodeTiff(await file.arrayBuffer());
}

export async function decodeTiffDataUrl(dataUrl: string) {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("TIFF_DATA_UNAVAILABLE");
  return decodeTiff(await response.arrayBuffer());
}

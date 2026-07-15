import UTIF from "utif";

export const TIFF_MIME_TYPES = ["image/tiff", "image/x-tiff"] as const;
export const TIFF_MAX_PIXELS = 40_000_000;

export function isTiffFile(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();
  return TIFF_MIME_TYPES.includes(file.type as (typeof TIFF_MIME_TYPES)[number]) || extension === "tif" || extension === "tiff";
}

/** Decodes the first TIFF page to a PNG data URL understood by Canvas/Image. */
export async function convertTiffToPng(file: File) {
  const buffer = await file.arrayBuffer();
  const frames = UTIF.decode(buffer);
  const frame = frames[0];

  if (!frame?.width || !frame.height || frame.width * frame.height > TIFF_MAX_PIXELS) {
    throw new Error("TIFF_DIMENSIONS_UNSUPPORTED");
  }

  UTIF.decodeImage(buffer, frame);
  const rgba = UTIF.toRGBA8(frame);
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("TIFF_CANVAS_UNAVAILABLE");

  context.putImageData(new ImageData(new Uint8ClampedArray(rgba), frame.width, frame.height), 0, 0);
  return { dataUrl: canvas.toDataURL("image/png"), width: frame.width, height: frame.height };
}

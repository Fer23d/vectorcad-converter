import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 100_000_000;

export type SupportedImageFormat = "png" | "jpeg" | "webp" | "tiff";

export function detectImageFormat(bytes: Uint8Array): SupportedImageFormat | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  if (bytes.length >= 4 && ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))) return "tiff";
  return null;
}

export function mimeForImageFormat(format: SupportedImageFormat) {
  return format === "jpeg" ? "image/jpeg" : `image/${format}`;
}

export async function validateImageBuffer(buffer: Buffer) {
  const format = detectImageFormat(buffer);
  if (!format) throw new Error("UNSUPPORTED_IMAGE_SIGNATURE");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) throw new Error("IMAGE_TOO_LARGE");
  const metadata = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (!width || !height || width * height > MAX_IMAGE_PIXELS) throw new Error("IMAGE_DIMENSIONS_TOO_LARGE");
  if (metadata.format && !["png", "jpeg", "webp", "tiff"].includes(metadata.format)) throw new Error("IMAGE_FORMAT_MISMATCH");
  return { format, width, height, mimeType: mimeForImageFormat(format) };
}

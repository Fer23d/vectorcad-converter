import sharp from "sharp";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_INPUT_PIXELS = 100_000_000;
const MAX_OUTPUT_PIXELS = 16_000_000;
const MAX_OUTPUT_DIMENSION = 4_000;

type EnhanceMode = "2x" | "3x" | "4x";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message, fallback: true }, { status });
}

function modeScale(mode: EnhanceMode) {
  return mode === "2x" ? 2 : mode === "3x" ? 3 : 4;
}

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const form = await request.formData();
    const file = form.get("image");
    const requestedMode = String(form.get("mode") || "3x");
    const mode: EnhanceMode = requestedMode === "2x" || requestedMode === "4x" ? requestedMode : "3x";

    if (!(file instanceof File)) return jsonError("Imagem não enviada.", 400);
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) return jsonError("A imagem excede o limite seguro de 12 MB.", 413);

    const buffer = Buffer.from(await file.arrayBuffer());
    const input = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "warning" });
    const metadata = await input.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    if (!width || !height || width * height > MAX_INPUT_PIXELS) return jsonError("A resolução da imagem excede o limite seguro.", 413);

    const scale = modeScale(mode);
    const targetWidth = Math.min(MAX_OUTPUT_DIMENSION, Math.max(1, width * scale));
    const targetHeight = Math.min(MAX_OUTPUT_DIMENSION, Math.max(1, height * scale));
    const ratio = Math.min(1, Math.sqrt(MAX_OUTPUT_PIXELS / (targetWidth * targetHeight)));
    const outputWidth = Math.max(1, Math.floor(targetWidth * ratio));
    const outputHeight = Math.max(1, Math.floor(targetHeight * ratio));

    const output = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "warning" })
      .rotate()
      .resize({ width: outputWidth, height: outputHeight, fit: "inside", withoutEnlargement: false, kernel: "lanczos3" })
      .sharpen(mode === "4x" ? 1.2 : mode === "3x" ? 1 : 0.8, 1, 2)
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();

    return NextResponse.json({
      imageDataUrl: `data:image/png;base64,${output.toString("base64")}`,
      originalWidth: width,
      originalHeight: height,
      finalWidth: outputWidth,
      finalHeight: outputHeight,
      mode,
      processingMs: Date.now() - started,
      stages: ["Analisando imagem", "Melhorando resolução", "Aplicando limpeza", "Finalizando"],
    });
  } catch (error) {
    console.error("[vetorcad][image-enhance] server processing failed", { code: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
    return jsonError("Não foi possível melhorar esta imagem no servidor.", 500);
  }
}

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export const MAX_PDF_BYTES = 30 * 1024 * 1024;
const MAX_RENDERED_DIMENSION = 4096;
const MAX_RENDERED_PIXELS = 16_000_000;

export type RenderedPdfPage = {
  dataUrl: string;
  width: number;
  height: number;
  pageCount: number;
};

function isPdfSignature(bytes: Uint8Array) {
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
}

/** Renders only the first PDF page as a raster image for the existing CAD pipeline. */
export async function renderPdfFirstPage(file: File, onProgress?: (stage: string) => void): Promise<RenderedPdfPage> {
  if (file.size > MAX_PDF_BYTES) throw new Error("PDF_TOO_LARGE");

  onProgress?.("Lendo PDF...");
  const data = new Uint8Array(await file.arrayBuffer());
  if (!isPdfSignature(data)) throw new Error("INVALID_PDF_SIGNATURE");

  onProgress?.("Renderizando página...");
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  try {
    const page = await pdf.getPage(1);
    onProgress?.("Preparando arquivo para CAD...");
    const baseViewport = page.getViewport({ scale: 1 });
    const basePixels = baseViewport.width * baseViewport.height;
    const dimensionScale = MAX_RENDERED_DIMENSION / Math.max(baseViewport.width, baseViewport.height, 1);
    const pixelScale = Math.sqrt(MAX_RENDERED_PIXELS / Math.max(basePixels, 1));
    const scale = Math.min(2, dimensionScale > 1 ? dimensionScale : 1, pixelScale > 1 ? pixelScale : 1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("PDF_CANVAS_UNAVAILABLE");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;

    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
      pageCount: pdf.numPages,
    };
  } finally {
    await pdf.destroy();
  }
}

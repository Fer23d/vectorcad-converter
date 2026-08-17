export type PdfPageSize = "A4" | "A3" | "A2" | "A1" | "A0";
export type PdfOrientation = "portrait" | "landscape";

const PAGE_SIZES_MM: Record<PdfPageSize, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
};

type PdfOptions = { pageSize: PdfPageSize; orientation: PdfOrientation };

function ascii(value: string) {
  return new TextEncoder().encode(value);
}

function concatBytes(...parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

async function deflate(data: Uint8Array) {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new CompressionStream("deflate");
  const writer = stream.writable.getWriter();
  await writer.write(data as unknown as ArrayBuffer);
  await writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

function makePdf(imageData: { data: Uint8Array; width: number; height: number }, pageSize: PdfPageSize, orientation: PdfOrientation, compressed: Uint8Array | null) {
  const [widthMm, heightMm] = PAGE_SIZES_MM[pageSize];
  const pageWidthMm = orientation === "portrait" ? widthMm : heightMm;
  const pageHeightMm = orientation === "portrait" ? heightMm : widthMm;
  const pointsPerMm = 72 / 25.4;
  const pageWidth = pageWidthMm * pointsPerMm;
  const pageHeight = pageHeightMm * pointsPerMm;
  const margin = 12 * pointsPerMm;
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;
  const imageRatio = imageData.width / Math.max(1, imageData.height);
  const availableRatio = availableWidth / availableHeight;
  const drawWidth = imageRatio > availableRatio ? availableWidth : availableHeight * imageRatio;
  const drawHeight = imageRatio > availableRatio ? availableWidth / imageRatio : availableHeight;
  const x = (pageWidth - drawWidth) / 2;
  const y = (pageHeight - drawHeight) / 2;
  const imageBytes = compressed || imageData.data;
  const imageFilter = compressed ? "/Filter /FlateDecode " : "";

  const objects = [
    ascii("<< /Type /Catalog /Pages 2 0 R >>"),
    ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(3)} ${pageHeight.toFixed(3)}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    concatBytes(ascii(`<< /Type /XObject /Subtype /Image /Width ${imageData.width} /Height ${imageData.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 ${imageFilter}/Length ${imageBytes.length} >>\nstream\n`), imageBytes, ascii("\nendstream")),
    ascii(`<< /Length ${ascii(`q ${drawWidth.toFixed(3)} 0 0 ${drawHeight.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm /Im0 Do Q\n`).length} >>\nstream\nq ${drawWidth.toFixed(3)} 0 0 ${drawHeight.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm /Im0 Do Q\nendstream`),
  ];

  const header = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 255, 255, 255, 255, 10]);
  const body: Uint8Array[] = [header];
  const offsets = [0];
  let offset = header.length;
  objects.forEach((object, index) => {
    offsets.push(offset);
    const wrapped = concatBytes(ascii(`${index + 1} 0 obj\n`), object, ascii("\nendobj\n"));
    body.push(wrapped);
    offset += wrapped.length;
  });
  const xrefOffset = offset;
  const xref = [`xref`, `0 ${objects.length + 1}`, `0000000000 65535 f `, ...offsets.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n `), `trailer`, `<< /Size ${objects.length + 1} /Root 1 0 R >>`, `startxref`, String(xrefOffset), `%%EOF`].join("\n");
  body.push(ascii(xref));
  return concatBytes(...body);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("PDF_IMAGE_UNAVAILABLE"));
    image.src = src;
  });
}

/** Creates a single-page PDF from the current raster image without changing its processing resolution. */
export async function exportImageToPdf(imageSource: string, options: PdfOptions) {
  const image = await loadImage(imageSource);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("PDF_CANVAS_UNAVAILABLE");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height);
  const rgb = new Uint8Array(canvas.width * canvas.height * 3);
  for (let source = 0, target = 0; source < rgba.data.length; source += 4) {
    rgb[target++] = rgba.data[source];
    rgb[target++] = rgba.data[source + 1];
    rgb[target++] = rgba.data[source + 2];
  }
  const compressed = await deflate(rgb);
  return new Blob([makePdf({ data: rgb, width: canvas.width, height: canvas.height }, options.pageSize, options.orientation, compressed)], { type: "application/pdf" });
}

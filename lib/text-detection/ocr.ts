import type { DetectedText } from "@/types/vector";

function imageDataToCanvas(image: ImageData) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("OCR_CANVAS_UNAVAILABLE");
  context.putImageData(image, 0, 0);
  return canvas;
}

type OcrPageMode = 6 | 7 | 8 | 11 | 12;
type OcrRegion = { x: number; y: number; width: number; height: number };

export type TextDetectionResult = {
  texts: DetectedText[];
  regionsAnalyzed: number;
  diagnostic: OcrDiagnostic;
};

export type OcrDiagnostic = {
  imageWidth: number;
  imageHeight: number;
  componentsFound: number;
  regionsCreated: number;
  averageCropWidth: number;
  averageCropHeight: number;
  tesseractCalls: number;
  rawResults: number;
  variantsTested: number;
  bestVariant: string;
  bestConfidence: number;
  originalImage: string;
  grayscaleImage: string;
  thresholdImage: string;
  variantPreviews: Array<{ name: string; image: string }>;
  directOcr: { rawText: string; confidence: number; psm: number };
  acceptedResults: number;
  worker: { created: boolean; languages: string[]; version: string };
  inputStats: { width: number; height: number; format: string; nonTransparentPixels: number; darkPixels: number };
  syntheticOcr: Array<{ language: string; rawText: string; confidence: number }>;
  rawAttempts: Array<{ variant: string; psm: number; originalWidth: number; originalHeight: number; resizedWidth: number; resizedHeight: number; rawText: string; confidence: number }>;
  binaryImage: string;
  regionMask: string;
  cropPreviews: string[];
};

function otsuThreshold(gray: Uint8Array) {
  const histogram = new Uint32Array(256);
  for (const value of gray) histogram[value] += 1;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let threshold = 180;
  for (let i = 0; i < 256; i++) {
    backgroundWeight += histogram[i];
    if (!backgroundWeight) continue;
    const foregroundWeight = total - backgroundWeight;
    if (!foregroundWeight) break;
    backgroundSum += i * histogram[i];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = i;
    }
  }
  return Math.max(120, Math.min(220, threshold));
}

/** Creates a high-contrast OCR-only copy. The editor's original/processed images are untouched. */
function prepareOcrImage(image: ImageData) {
  const maxDimension = Math.max(image.width, image.height);
  const scale = Math.min(3, Math.max(1, 1800 / Math.max(1, maxDimension)));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("OCR_CANVAS_UNAVAILABLE");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const sourceCanvas = imageDataToCanvas(image);
  context.drawImage(sourceCanvas, 0, 0, width, height);
  const prepared = context.getImageData(0, 0, width, height);
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = Math.round(prepared.data[p] * .299 + prepared.data[p + 1] * .587 + prepared.data[p + 2] * .114);
  }
  const threshold = otsuThreshold(gray);
  const grayscale = new ImageData(new Uint8ClampedArray(prepared.data), width, height);
  let darkPixels = 0;
  for (let i = 0; i < gray.length; i++) {
    const isDark = gray[i] < threshold;
    if (isDark) darkPixels += 1;
    const p = i * 4;
    const value = isDark ? 0 : 255;
    prepared.data[p] = value;
    prepared.data[p + 1] = value;
    prepared.data[p + 2] = value;
    prepared.data[p + 3] = 255;
  }
  return { image: prepared, grayscale, threshold: prepared, scale, darkRatio: darkPixels / Math.max(1, gray.length) };
}

function detectCandidateRegions(image: ImageData): { regions: OcrRegion[]; componentsFound: number; mask: Uint8Array } {
  const { width, height, data } = image;
  const total = width * height;
  const dark = new Uint8Array(total);
  for (let i = 0; i < total; i++) dark[i] = data[i * 4] < 128 ? 1 : 0;

  // Long CAD lines are removed only from the OCR mask, never from the editor image.
  const lineLength = Math.max(24, Math.floor(Math.min(width, height) * .08));
  for (let y = 0; y < height; y++) {
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const isDark = x < width && dark[y * width + x] === 1;
      if (isDark && start < 0) start = x;
      if ((!isDark || x === width) && start >= 0) {
        if (x - start >= lineLength) for (let i = start; i < x; i++) dark[y * width + i] = 0;
        start = -1;
      }
    }
  }
  for (let x = 0; x < width; x++) {
    let start = -1;
    for (let y = 0; y <= height; y++) {
      const isDark = y < height && dark[y * width + x] === 1;
      if (isDark && start < 0) start = y;
      if ((!isDark || y === height) && start >= 0) {
        if (y - start >= lineLength) for (let i = start; i < y; i++) dark[i * width + x] = 0;
        start = -1;
      }
    }
  }

  const seen = new Uint8Array(total);
  const components: OcrRegion[] = [];
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const startIndex = y * width + x;
    if (!dark[startIndex] || seen[startIndex]) continue;
    const queue = [startIndex];
    seen[startIndex] = 1;
    let minX = x, maxX = x, minY = y, maxY = y, area = 0;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      const cx = index % width, cy = Math.floor(index / width);
      area++;
      minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
      minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const nx = cx + ox, ny = cy + oy;
        const neighbor = ny * width + nx;
        if (nx > 0 && ny > 0 && nx < width - 1 && ny < height - 1 && dark[neighbor] && !seen[neighbor]) {
          seen[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }
    const componentWidth = maxX - minX + 1, componentHeight = maxY - minY + 1;
    if (area >= 3 && componentWidth <= width * .25 && componentHeight <= height * .15) {
      components.push({ x: minX, y: minY, width: componentWidth, height: componentHeight });
    }
  }

  // Join nearby glyph components into word/annotation boxes.
  const groups: OcrRegion[] = [];
  for (const component of components.sort((a, b) => a.y - b.y || a.x - b.x)) {
    const match = groups.find((group) => {
      const pad = Math.max(8, Math.max(group.height, component.height) * 2.5);
      const horizontalGap = Math.max(group.x, component.x) - Math.min(group.x + group.width, component.x + component.width);
      const verticalGap = Math.max(group.y, component.y) - Math.min(group.y + group.height, component.y + component.height);
      return horizontalGap <= pad && verticalGap <= pad;
    });
    if (!match) groups.push({ ...component });
    else {
      const right = Math.max(match.x + match.width, component.x + component.width);
      const bottom = Math.max(match.y + match.height, component.y + component.height);
      match.x = Math.min(match.x, component.x);
      match.y = Math.min(match.y, component.y);
      match.width = right - match.x;
      match.height = bottom - match.y;
    }
  }
  const regions = groups
    .map((region) => ({ x: Math.max(0, region.x - 8), y: Math.max(0, region.y - 8), width: Math.min(width - Math.max(0, region.x - 8), region.width + 16), height: Math.min(height - Math.max(0, region.y - 8), region.height + 16) }))
    .filter((region) => region.width >= 12 && region.height >= 8 && region.width * region.height <= width * height * .2)
    .slice(0, 80);
  return { regions, componentsFound: components.length, mask: dark };
}

function cropRegion(image: ImageData, region: OcrRegion) {
  const canvas = imageDataToCanvas(image);
  const crop = document.createElement("canvas");
  crop.width = region.width;
  crop.height = region.height;
  const context = crop.getContext("2d");
  if (!context) throw new Error("OCR_CANVAS_UNAVAILABLE");
  context.drawImage(canvas, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
  return crop;
}

function canvasToMask(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("OCR_CANVAS_UNAVAILABLE");
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const mask = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < mask.length; i++) mask[i] = image.data[i * 4] < 128 ? 1 : 0;
  return mask;
}

function maskToCanvas(mask: Uint8Array, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("OCR_CANVAS_UNAVAILABLE");
  const image = context.createImageData(width, height);
  for (let i = 0; i < mask.length; i++) {
    const value = mask[i] ? 0 : 255;
    const p = i * 4;
    image.data[p] = value;
    image.data[p + 1] = value;
    image.data[p + 2] = value;
    image.data[p + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function dilate(mask: Uint8Array, width: number, height: number, radius = 1) {
  const output = new Uint8Array(mask);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (mask[y * width + x]) continue;
    let found = false;
    for (let oy = -radius; oy <= radius && !found; oy++) for (let ox = -radius; ox <= radius; ox++) {
      const nx = x + ox, ny = y + oy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && mask[ny * width + nx]) { found = true; break; }
    }
    if (found) output[y * width + x] = 1;
  }
  return output;
}

function erode(mask: Uint8Array, width: number, height: number, radius = 1) {
  const output = new Uint8Array(mask);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!mask[y * width + x]) continue;
    for (let oy = -radius; oy <= radius; oy++) for (let ox = -radius; ox <= radius; ox++) {
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || !mask[ny * width + nx]) { output[y * width + x] = 0; break; }
    }
  }
  return output;
}

function fillHoles(mask: Uint8Array, width: number, height: number) {
  const background = new Uint8Array(mask.length);
  const queue: number[] = [];
  const enqueue = (index: number) => { if (!background[index] && !mask[index]) { background[index] = 1; queue.push(index); } };
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor], x = index % width, y = Math.floor(index / width);
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox, ny = y + oy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height) enqueue(ny * width + nx);
    }
  }
  const output = new Uint8Array(mask);
  for (let i = 0; i < output.length; i++) if (!mask[i] && !background[i]) output[i] = 1;
  return output;
}

function createOcrVariants(canvas: HTMLCanvasElement) {
  const mask = canvasToMask(canvas);
  const width = canvas.width, height = canvas.height;
  const filled = fillHoles(mask, width, height);
  const closed = erode(dilate(mask, width, height, 1), width, height, 1);
  const inverted = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) inverted[i] = mask[i] ? 0 : 1;
  return [
    { name: "normal", canvas },
    { name: "invertida", canvas: maskToCanvas(inverted, width, height) },
    { name: "preenchida", canvas: maskToCanvas(filled, width, height) },
    { name: "dilatada", canvas: maskToCanvas(dilate(mask, width, height, 1), width, height) },
    { name: "fechamento", canvas: maskToCanvas(closed, width, height) },
  ];
}

function validCharacterCount(value: string) {
  return (value.match(/[A-Za-zÀ-ÿ0-9]/g) || []).length;
}

function canvasDataUrl(canvas: HTMLCanvasElement) {
  return canvas.toDataURL("image/png");
}

function maskDataUrl(mask: Uint8Array, width: number, height: number, regions: OcrRegion[]) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("OCR_CANVAS_UNAVAILABLE");
  const image = context.createImageData(width, height);
  for (let i = 0; i < mask.length; i++) {
    const value = mask[i] ? 0 : 255;
    const p = i * 4;
    image.data[p] = value;
    image.data[p + 1] = value;
    image.data[p + 2] = value;
    image.data[p + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  context.strokeStyle = "#ff3b30";
  context.lineWidth = Math.max(1, Math.round(Math.min(width, height) / 900));
  for (const region of regions) context.strokeRect(region.x, region.y, region.width, region.height);
  return canvasDataUrl(canvas);
}

function extractWords(data: { blocks: Array<{ paragraphs: Array<{ lines: Array<{ words: Array<{ text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }> }> }> }> | null }) {
  return (data.blocks || [])
    .flatMap((block) => block.paragraphs)
    .flatMap((paragraph) => paragraph.lines)
    .flatMap((line) => line.words);
}

function normalizeCandidateText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function hasMinimumTextContent(text: string) {
  return Array.from(text).filter((character) => /[\p{L}\p{N}]/u.test(character)).length >= 3;
}

export function createDirectTextCandidates(rawText: string, width: number, height: number, confidence = 0): DetectedText[] {
  const lines = rawText.split(/\r?\n/).map(normalizeCandidateText).filter(hasMinimumTextContent);
  const safeConfidence = Math.max(0, Math.min(1, confidence));
  const lineHeight = Math.max(12, height / Math.max(1, lines.length));
  return lines.map((text, index) => ({
    text,
    x: 0,
    y: Math.round(index * lineHeight),
    width: Math.max(1, width),
    height: Math.max(1, Math.min(lineHeight, height)),
    rotation: 0,
    confidence: safeConfidence,
    rawConfidence: safeConfidence,
    confidenceFinal: safeConfidence,
  }));
}

function getImageStats(image: ImageData) {
  let nonTransparentPixels = 0;
  let darkPixels = 0;
  for (let index = 0; index < image.data.length; index += 4) {
    const alpha = image.data[index + 3];
    if (alpha > 0) nonTransparentPixels += 1;
    if (alpha > 0 && (image.data[index] * 299 + image.data[index + 1] * 587 + image.data[index + 2] * 114) / 1000 < 128) darkPixels += 1;
  }
  return { width: image.width, height: image.height, format: "ImageData RGBA8 via canvas", nonTransparentPixels, darkPixels };
}

function createSyntheticOcrImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 180;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("OCR_CANVAS_UNAVAILABLE");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000000";
  context.font = "bold 72px Arial, sans-serif";
  context.textBaseline = "middle";
  context.fillText("TESTE 123", 24, canvas.height / 2);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

/** Runs OCR only when requested, keeping the heavy language model out of initial page load. */
export async function detectText(image: ImageData, originalImage: ImageData = image): Promise<TextDetectionResult> {
  if (typeof document === "undefined") throw new Error("OCR_BROWSER_REQUIRED");
  const inputStats = getImageStats(originalImage);
  console.info("[VectorCAD][OCR] entrada", inputStats);
  const prepared = prepareOcrImage(image);
  const candidates = detectCandidateRegions(prepared.image);
  const regions = candidates.regions.slice(0, 24);
  const binaryCanvas = imageDataToCanvas(prepared.image);
  const cropCanvases = regions.slice(0, 24).map((region) => cropRegion(prepared.image, region));
  const variantPreviews = regions.length ? createOcrVariants(cropCanvases[0]).map((variant) => ({ name: variant.name, image: canvasDataUrl(variant.canvas) })) : [];
  const { createWorker } = await import("tesseract.js");
  const workerLanguages = ["eng", "por", "por+eng"];
  const workerEvents = new Set<string>();
  const worker = await createWorker("por+eng", 1, {
    logger: (message) => {
      if (message.status && (message.status.includes("load") || message.status.includes("init") || message.status.includes("recogniz"))) workerEvents.add(message.status);
    },
  });
  console.info("[VectorCAD][OCR][worker] criado", { languages: ["por+eng"], loaded: true, events: [...workerEvents] });
  try {
    const syntheticImage = createSyntheticOcrImage();
    const syntheticOcr: OcrDiagnostic["syntheticOcr"] = [];
    for (const language of workerLanguages) {
      await worker.reinitialize(language, 1);
      await worker.setParameters({ tessedit_pageseg_mode: "7" as never });
      const syntheticResult = await worker.recognize(imageDataToCanvas(syntheticImage));
      const syntheticWords = extractWords(syntheticResult.data);
      const syntheticText = syntheticResult.data.text?.trim() || syntheticWords.map((word) => word.text).join(" ").trim();
      const syntheticConfidence = syntheticWords.length ? syntheticWords.reduce((total, word) => total + word.confidence / 100, 0) / syntheticWords.length : 0;
      syntheticOcr.push({ language, rawText: syntheticText, confidence: syntheticConfidence });
      console.info("[VectorCAD][OCR][synthetic] resultado bruto", { language, rawText: syntheticText, confidence: Number(syntheticConfidence.toFixed(3)), width: syntheticImage.width, height: syntheticImage.height, version: syntheticResult.data.version || "indisponível" });
    }
    await worker.reinitialize("por+eng", 1);
    console.info("[VectorCAD][OCR][worker] modelos carregados", { languages: workerLanguages, version: "será reportada pelo resultado OCR", syntheticResults: syntheticOcr.length });
    const directPsm = 6;
    await worker.setParameters({ tessedit_pageseg_mode: String(directPsm) as never });
    let tesseractCalls = 0;
    tesseractCalls += 1;
    const directResult = await worker.recognize(imageDataToCanvas(originalImage));
    const directWords = extractWords(directResult.data);
    const directConfidence = directWords.length ? directWords.reduce((total, word) => total + word.confidence / 100, 0) / directWords.length : 0;
    const directOcr = { rawText: directResult.data.text?.trim() || directWords.map((word) => word.text).join(" ").trim(), confidence: directConfidence, psm: directPsm };
    const workerVersion = directResult.data.version || "indisponível";
    console.info("[VectorCAD][OCR] OCR direto bruto", { rawText: directOcr.rawText, confidence: Number(directConfidence.toFixed(3)), version: workerVersion });
    const wordCandidates: DetectedText[] = directWords.flatMap((word) => {
      const text = normalizeCandidateText(word.text);
      if (!hasMinimumTextContent(text)) return [];
      const rawConfidence = Math.max(0, Math.min(1, word.confidence / 100));
      return [{ text, x: word.bbox.x0, y: word.bbox.y0, width: Math.max(1, word.bbox.x1 - word.bbox.x0), height: Math.max(1, word.bbox.y1 - word.bbox.y0), rotation: 0, confidence: rawConfidence, rawConfidence, confidenceFinal: rawConfidence }];
    });
    const directCandidates = wordCandidates.length ? wordCandidates : createDirectTextCandidates(directOcr.rawText, originalImage.width, originalImage.height, directConfidence);
    const detected: DetectedText[] = [...directCandidates];
    let rawResults = directWords.length ? directWords.filter((word) => normalizeCandidateText(word.text).length > 0).length : createDirectTextCandidates(directOcr.rawText, originalImage.width, originalImage.height, directConfidence).length;
    let variantsTested = 0;
    let bestVariant = "nenhuma";
    let bestScore = -1;
    let bestConfidence = 0;
    const rawAttempts: OcrDiagnostic["rawAttempts"] = [];
    const modes: OcrPageMode[] = [6, 7, 8, 11, 12];
    for (const region of regions) {
      const regionBest: { texts: DetectedText[]; score: number; variant: string } = { texts: [], score: -1, variant: "nenhuma" };
      for (const variant of createOcrVariants(cropRegion(prepared.image, region))) {
        variantsTested += 1;
        const variantTexts: DetectedText[] = [];
        for (const pageMode of modes) {
          await worker.setParameters({ tessedit_pageseg_mode: String(pageMode) as never });
          tesseractCalls += 1;
          const { data } = await worker.recognize(variant.canvas);
          const attemptWords = extractWords(data);
          rawResults += attemptWords.filter((word) => normalizeCandidateText(word.text).length > 0).length;
          const attemptConfidence = attemptWords.length ? attemptWords.reduce((total, word) => total + word.confidence / 100, 0) / attemptWords.length : 0;
          rawAttempts.push({ variant: variant.name, psm: pageMode, originalWidth: Math.round(region.width / prepared.scale), originalHeight: Math.round(region.height / prepared.scale), resizedWidth: region.width, resizedHeight: region.height, rawText: data.text?.trim() || attemptWords.map((word) => word.text).join(" ").trim(), confidence: attemptConfidence });
          for (const word of extractWords(data)) {
            const text = normalizeCandidateText(word.text);
            const rawConfidence = Math.max(0, Math.min(1, word.confidence / 100));
            const value = { text, x: (region.x + word.bbox.x0) / prepared.scale, y: (region.y + word.bbox.y0) / prepared.scale, width: Math.max(1, (word.bbox.x1 - word.bbox.x0) / prepared.scale), height: Math.max(1, (word.bbox.y1 - word.bbox.y0) / prepared.scale), rotation: 0, confidence: rawConfidence, rawConfidence, confidenceFinal: rawConfidence };
            if (hasMinimumTextContent(text) && value.width > 1 && value.height > 1) variantTexts.push(value);
          }
        }
        const validCharacters = variantTexts.reduce((total, word) => total + validCharacterCount(word.text), 0);
        const confidence = variantTexts.length ? variantTexts.reduce((total, word) => total + word.confidence, 0) / variantTexts.length : 0;
        const score = confidence * .65 + Math.min(1, validCharacters / 24) * .35;
        if (score > regionBest.score) {
          regionBest.texts = variantTexts.filter((word, index, values) => values.findIndex((candidate) => candidate.text === word.text && Math.abs(candidate.x - word.x) < 2 && Math.abs(candidate.y - word.y) < 2) === index);
          regionBest.score = score;
          regionBest.variant = variant.name;
        }
      }
      detected.push(...regionBest.texts);
      if (regionBest.score > bestScore) {
        bestScore = regionBest.score;
        bestVariant = regionBest.variant;
      }
      if (regionBest.texts.length) {
        bestConfidence = Math.max(bestConfidence, regionBest.texts.reduce((total, word) => total + word.confidence, 0) / regionBest.texts.length);
      }
    }
    const unique = detected.filter((word, index, values) => values.findIndex((candidate) => candidate.text === word.text && Math.abs(candidate.x - word.x) < 2 && Math.abs(candidate.y - word.y) < 2) === index);
    const confidence = unique.length ? unique.reduce((total, word) => total + word.confidence, 0) / unique.length : 0;
    console.info("[VectorCAD][OCR]", {
      regionsAnalyzed: regions.length,
      textsFound: unique.length,
      componentsFound: candidates.componentsFound,
      tesseractCalls,
      rawResults,
      acceptedResults: unique.length,
      variantsTested,
      bestVariant,
      bestConfidence: Number(bestConfidence.toFixed(3)),
      directOcr,
      worker: { created: true, languages: workerLanguages, version: workerVersion },
      inputStats,
      syntheticOcr,
      rawAttempts,
      averageCropWidth: regions.length ? Math.round(regions.reduce((total, region) => total + region.width, 0) / regions.length) : 0,
      averageCropHeight: regions.length ? Math.round(regions.reduce((total, region) => total + region.height, 0) / regions.length) : 0,
      averageConfidence: Number(confidence.toFixed(3)),
      imageWidth: prepared.image.width,
      imageHeight: prepared.image.height,
      cropSizes: regions.map(({ width, height }) => `${width}x${height}`),
    });
    return {
      texts: unique,
      regionsAnalyzed: regions.length,
      diagnostic: {
        imageWidth: prepared.image.width,
        imageHeight: prepared.image.height,
        componentsFound: candidates.componentsFound,
        regionsCreated: regions.length,
        averageCropWidth: regions.length ? Math.round(regions.reduce((total, region) => total + region.width, 0) / regions.length) : 0,
        averageCropHeight: regions.length ? Math.round(regions.reduce((total, region) => total + region.height, 0) / regions.length) : 0,
        tesseractCalls,
        rawResults,
        acceptedResults: unique.length,
        variantsTested,
        bestVariant,
        bestConfidence: Number(bestConfidence.toFixed(3)),
        originalImage: canvasDataUrl(imageDataToCanvas(originalImage)),
        grayscaleImage: canvasDataUrl(imageDataToCanvas(prepared.grayscale)),
        thresholdImage: canvasDataUrl(imageDataToCanvas(prepared.threshold)),
        variantPreviews,
        directOcr,
        worker: { created: true, languages: workerLanguages, version: workerVersion },
        inputStats,
        syntheticOcr,
        rawAttempts,
        binaryImage: canvasDataUrl(binaryCanvas),
        regionMask: maskDataUrl(candidates.mask, prepared.image.width, prepared.image.height, regions),
        cropPreviews: cropCanvases.map(canvasDataUrl),
      },
    };
  } finally {
    await worker.terminate();
  }
}

/** Removes OCR regions from the bitmap so text is not converted into CAD polylines. */
export function protectTextRegions(bitmap: Uint8Array, width: number, height: number, regions: DetectedText[], margin = 1) {
  const protectedBitmap = new Uint8Array(bitmap);
  for (const region of regions) {
    const left = Math.max(0, Math.floor(region.x - margin));
    const top = Math.max(0, Math.floor(region.y - margin));
    const right = Math.min(width, Math.ceil(region.x + region.width + margin));
    const bottom = Math.min(height, Math.ceil(region.y + region.height + margin));
    for (let y = top; y < bottom; y++) protectedBitmap.fill(0, y * width + left, y * width + right);
  }
  return protectedBitmap;
}

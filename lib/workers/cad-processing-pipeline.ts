import { recognizeDocumentArchitecture } from "@/lib/architecture-recognition/architecture-engine";
import { createDocumentTopology, createProjectScale } from "@/lib/architecture-recognition/topology-engine";
import { createDocumentBimModel } from "@/lib/bim-recognition/bim-engine";
import { recognizeDocumentGeometry } from "@/lib/geometry-recognition/recognition-engine";
import { processCadCleanImage } from "@/lib/image-processing/cad-clean";
import { enhanceForCad, processPixels } from "@/lib/image-processing/process";
import { cleanupVectorDocument } from "@/lib/vector/vector-cleanup";
import { lineIntelligenceEngine } from "@/lib/vector/line-intelligence";
import { scaleDocument, vectorizeBitmap } from "@/lib/vectorize/contours";
import { skeletonizeBitmap } from "@/lib/vectorize/skeleton";
import type { CadProcessingInput, CadProcessingProgress, CadProcessingResult } from "@/lib/workers/protocols";
import type { DetectedText, ImageQuality } from "@/types/vector";

const emptyMetrics = {
  pathsReceived: 0,
  detected: 0,
  strong: 0,
  medium: 0,
  weak: 0,
  kept: 0,
  removed: 0,
  unified: 0,
  beforeSegments: 0,
  afterSegments: 0,
  improvementPercent: 0,
  reductionPercent: 0,
};

function report(progress: CadProcessingProgress, callback?: (progress: CadProcessingProgress) => void) {
  callback?.(progress);
}

function outputImage(image: ImageData) {
  const data = new Uint8ClampedArray(image.data);
  return { data: data.buffer, width: image.width, height: image.height };
}

function protectTextRegions(bitmap: Uint8Array, width: number, height: number, regions: DetectedText[], margin = 1) {
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

function ensureActive(isCancelled?: () => boolean) {
  if (isCancelled?.()) throw new Error("CAD_PROCESSING_CANCELLED");
}

/**
 * CPU-only version of the editor pipeline. Keeping the exact algorithms here
 * lets a Worker run the same geometry workflow without changing its output.
 */
export function runCadProcessingPipeline(input: CadProcessingInput, onProgress?: (progress: CadProcessingProgress) => void, isCancelled?: () => boolean): CadProcessingResult {
  const startedAt = performance.now();
  const { width, height } = input.image;
  const sourceImage = new ImageData(new Uint8ClampedArray(input.image.data), width, height);
  const pixelCount = width * height;
  report({ percent: 10, stage: "Preparando imagem" }, onProgress);
  ensureActive(isCancelled);

  const cadClean = input.imageQuality === "cad-clean" ? processCadCleanImage(sourceImage) : null;
  const enhanced = cadClean?.image || enhanceForCad(sourceImage, input.imageQuality);
  const processed = processPixels(enhanced, input.processing);
  let bitmap = input.detectedTexts.length ? protectTextRegions(processed.bitmap, width, height, input.detectedTexts) : processed.bitmap;
  if (input.detectedTexts.length) {
    for (let index = 0; index < bitmap.length; index += 1) {
      if (bitmap[index]) continue;
      const offset = index * 4;
      processed.image.data[offset] = 255;
      processed.image.data[offset + 1] = 255;
      processed.image.data[offset + 2] = 255;
      processed.image.data[offset + 3] = 255;
    }
  }

  report({ percent: 30, stage: "Extraindo contornos" }, onProgress);
  ensureActive(isCancelled);
  const rawDocument = vectorizeBitmap(bitmap, width, height, input.vector);
  const detectedLines = lineIntelligenceEngine.analyze(rawDocument.paths, width, height);
  const lineSelection = lineIntelligenceEngine.selectPaths(rawDocument.paths, detectedLines, input.lineProcessingMode, width, height);
  const cleanupMode = input.vector.outputMode === "pixel" ? "original" : input.vector.outputMode === "cad" ? "cad-clean" : "smooth";
  let cleanup = cleanupVectorDocument({ ...rawDocument, paths: lineSelection.paths }, cleanupMode);
  let selectedImage = processed.image;
  let selectedScore = lineIntelligenceEngine.score(detectedLines, cleanup.document.paths);

  if (input.lineProcessingMode === "auto") {
    const fallbackQualities = (["original", "enhanced", "ultra-pro", "cad-clean"] as ImageQuality[]).filter(quality => quality !== input.imageQuality);
    for (const fallbackQuality of fallbackQualities) {
      ensureActive(isCancelled);
      const fallbackSource = fallbackQuality === "cad-clean" ? processCadCleanImage(sourceImage).image : enhanceForCad(sourceImage, fallbackQuality);
      const fallbackResult = processPixels(fallbackSource, input.processing);
      const fallbackBitmap = input.detectedTexts.length ? protectTextRegions(fallbackResult.bitmap, width, height, input.detectedTexts) : fallbackResult.bitmap;
      const fallbackRaw = vectorizeBitmap(fallbackBitmap, width, height, input.vector);
      const fallbackLines = lineIntelligenceEngine.analyze(fallbackRaw.paths, width, height);
      const fallbackSelection = lineIntelligenceEngine.selectPaths(fallbackRaw.paths, fallbackLines, input.lineProcessingMode, width, height);
      const fallbackCleanup = cleanupVectorDocument({ ...fallbackRaw, paths: fallbackSelection.paths }, cleanupMode);
      const fallbackScore = lineIntelligenceEngine.score(fallbackLines, fallbackCleanup.document.paths);
      if (fallbackCleanup.document.paths.length && fallbackScore > selectedScore) {
        selectedScore = fallbackScore;
        cleanup = fallbackCleanup;
        selectedImage = fallbackResult.image;
        detectedLines.splice(0, detectedLines.length, ...fallbackLines);
        lineSelection.paths.splice(0, lineSelection.paths.length, ...fallbackSelection.paths);
        lineSelection.unified = fallbackSelection.unified;
        bitmap = fallbackBitmap;
        break;
      }
    }
  }

  report({ percent: 55, stage: "Reconhecendo geometria" }, onProgress);
  ensureActive(isCancelled);
  if (!cleanup.document.paths.length) {
    return {
      processedImage: outputImage(selectedImage),
      document: null,
      darkRatio: processed.darkRatio,
      cadCleanMetrics: cadClean?.metrics || { pixelsProcessed: 0, noiseRemoved: 0, contrastApplied: 0 },
      lineMetrics: { ...emptyMetrics, pathsReceived: detectedLines.length, detected: detectedLines.length, weak: detectedLines.length, removed: detectedLines.length, reductionPercent: detectedLines.length ? 100 : 0 },
      cleanupStats: { beforePaths: cleanup.beforePaths, afterPaths: cleanup.afterPaths, beforePoints: cleanup.beforePoints, afterPoints: cleanup.afterPoints, reductionPercent: cleanup.reductionPercent },
      diagnostics: {},
      benchmark: { durationMs: Math.round(performance.now() - startedAt), inputPixels: pixelCount, estimatedWorkingMemoryBytes: pixelCount * 14, paths: 0, entities: 0, architectureEntities: 0 },
    };
  }

  const recognizedGeometry = recognizeDocumentGeometry(cleanup.document, input.vector.recognitionProfile || "default");
  report({ percent: 75, stage: "Analisando arquitetura" }, onProgress);
  ensureActive(isCancelled);
  const skeleton = skeletonizeBitmap(bitmap, width, height);
  const recognizedArchitecture = recognizeDocumentArchitecture(recognizedGeometry.document, { skeleton });
  const projectScale = createProjectScale({ pixelWidth: width, pixelHeight: height, projectWidth: input.project.width, projectHeight: input.project.height, unit: input.project.unit });
  const topology = createDocumentTopology(recognizedArchitecture.document, projectScale);
  report({ percent: 95, stage: "Preparando documento CAD" }, onProgress);
  ensureActive(isCancelled);
  const canonicalDocument = scaleDocument(topology.document, input.project.width, input.project.height, input.project.unit);
  const bim = createDocumentBimModel(canonicalDocument);
  const document = bim.document;
  const lineMetrics = lineIntelligenceEngine.metrics(detectedLines, lineSelection.paths, lineSelection.unified);
  const architectureEntities = document.architectureEntities?.length || 0;
  const entities = document.entities?.length || 0;

  report({ percent: 100, stage: "Documento CAD pronto" }, onProgress);
  return {
    processedImage: outputImage(selectedImage),
    document,
    darkRatio: processed.darkRatio,
    cadCleanMetrics: cadClean?.metrics || { pixelsProcessed: 0, noiseRemoved: 0, contrastApplied: 0 },
    lineMetrics,
    cleanupStats: { beforePaths: cleanup.beforePaths, afterPaths: cleanup.afterPaths, beforePoints: cleanup.beforePoints, afterPoints: cleanup.afterPoints, reductionPercent: cleanup.reductionPercent },
    diagnostics: {
      geometry: recognizedGeometry.diagnostics,
      architecture: recognizedArchitecture.diagnostics,
      topology: { nodes: topology.graph.nodes.length, connections: topology.graph.connections.length, openings: topology.graph.openings.length },
      bim: { walls: bim.bimModel.walls.length, doors: bim.bimModel.doors.length, windows: bim.bimModel.windows.length, spaces: bim.bimModel.spaces.length, unconfirmed: bim.bimModel.unconfirmedCandidateIds.length },
    },
    benchmark: {
      durationMs: Math.round(performance.now() - startedAt),
      inputPixels: pixelCount,
      estimatedWorkingMemoryBytes: pixelCount * 14 + bitmap.byteLength + selectedImage.data.byteLength,
      paths: document.paths.length,
      entities,
      architectureEntities,
    },
  };
}

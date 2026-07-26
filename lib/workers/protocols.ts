import type { ArchitectureRecognitionDiagnostics } from "@/lib/architecture-recognition/architecture-engine";
import type { GeometryRecognitionDiagnostics } from "@/lib/geometry-recognition/recognition-engine";
import type { CadCleanMetrics } from "@/lib/image-processing/cad-clean";
import type { LineIntelligenceMetrics } from "@/lib/vector/line-intelligence";
import type { DetectedText, ImageQuality, LineProcessingMode, ProcessingSettings, Unit, VectorDocument, VectorSettings } from "@/types/vector";

export type CadProcessingImage = {
  data: ArrayBuffer;
  width: number;
  height: number;
};

export type CadProcessingInput = {
  image: CadProcessingImage;
  imageQuality: ImageQuality;
  processing: ProcessingSettings;
  vector: VectorSettings;
  detectedTexts: DetectedText[];
  lineProcessingMode: LineProcessingMode;
  project: { width: number; height: number; unit: Unit };
};

export type CadProcessingProgress = {
  percent: number;
  stage: string;
};

export type CadProcessingBenchmark = {
  durationMs: number;
  inputPixels: number;
  estimatedWorkingMemoryBytes: number;
  paths: number;
  entities: number;
  architectureEntities: number;
};

export type CadProcessingResult = {
  processedImage: CadProcessingImage;
  document: VectorDocument | null;
  darkRatio: number;
  cadCleanMetrics: CadCleanMetrics;
  lineMetrics: LineIntelligenceMetrics;
  cleanupStats: { beforePaths: number; afterPaths: number; beforePoints: number; afterPoints: number; reductionPercent: number };
  diagnostics: {
    geometry?: GeometryRecognitionDiagnostics;
    architecture?: ArchitectureRecognitionDiagnostics;
    topology?: { nodes: number; connections: number; openings: number };
    bim?: { walls: number; doors: number; windows: number; spaces: number; unconfirmed: number };
  };
  benchmark: CadProcessingBenchmark;
};

export type StartProcessMessage = { type: "START_PROCESS"; requestId: string; payload: CadProcessingInput };
export type CancelProcessMessage = { type: "CANCEL"; requestId: string };
export type CadProcessingWorkerRequest = StartProcessMessage | CancelProcessMessage;

export type ProgressUpdateMessage = { type: "PROGRESS_UPDATE"; requestId: string; progress: CadProcessingProgress };
export type ProcessResultMessage = { type: "RESULT"; requestId: string; result: CadProcessingResult };
export type ProcessErrorMessage = { type: "ERROR"; requestId: string; error: string; cancelled?: boolean };
export type CadProcessingWorkerResponse = ProgressUpdateMessage | ProcessResultMessage | ProcessErrorMessage;

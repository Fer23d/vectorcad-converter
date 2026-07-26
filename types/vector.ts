import type { CadEntity, CadPoint } from "@/types/cad-geometry";
import type { ArchitectureCandidate } from "@/types/architectural-geometry";
import type { ProjectScale, WallGraph } from "@/types/architecture-topology";
import type { BimModel } from "@/types/bim-geometry";
import type { CoordinateSystem } from "@/types/coordinate-system";

export type Unit = "mm" | "cm" | "px";
export type VectorMode = "logo" | "technical" | "silhouette" | "outline" | "precision" | "cnc";
export type OutputMode = "pixel" | "smooth" | "cad";
export type ImageQuality = "original" | "enhanced" | "ultra" | "ultra-pro" | "cad-clean" | "ai-enhance-2x" | "ai-enhance-3k" | "ai-enhance-4k";
export type LineProcessingMode = "manual" | "auto";
export type RecognitionProfile = "default" | "architecture" | "mechanical" | "logo" | "precision";
export type DetectedText = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  confidence: number;
  rawConfidence?: number;
  confidenceFinal?: number;
  value?: string;
  position?: { x: number; y: number };
  boundingBox?: { x: number; y: number; width: number; height: number };
  source?: "OCR";
};

export type Point = CadPoint;
export interface VectorPath { id?: string; points: Point[]; closed: boolean; curved?: boolean; layer: "CONTOURS" | "DETAILS" | "GUIDES" }
export interface VectorDocument {
  width: number;
  height: number;
  unit: Unit;
  sourceWidth: number;
  sourceHeight: number;
  paths: VectorPath[];
  /** Optional until each project is upgraded by the geometry recognition engine. */
  entities?: CadEntity[];
  /** Optional architectural interpretation; paths and CAD entities remain the source of truth. */
  architectureEntities?: ArchitectureCandidate[];
  /** Optional connected architectural model for later IFC/Revit mapping. */
  projectScale?: ProjectScale;
  topology?: WallGraph[];
  /** Optional BIM projection built from high-confidence architectural candidates. */
  bimModel?: BimModel;
  /** Canonical affine mapping shared by the document's geometric layers. */
  coordinateSystem?: CoordinateSystem;
}

export interface ProcessingSettings {
  brightness: number;
  contrast: number;
  threshold: number;
  adaptiveThreshold: boolean;
  blurRadius: number;
  morphologyRadius: number;
  openingRadius: number;
  minComponentArea: number;
  invert: boolean;
  removeNoise: boolean;
  smooth: boolean;
  edgeDetect: boolean;
}

export interface VectorSettings {
  mode: VectorMode;
  outputMode: OutputMode;
  simplification: number;
  minArea: number;
  smoothIterations: number;
  closePaths: boolean;
  joinDistance: number;
  recognitionProfile?: RecognitionProfile;
}

export type Unit = "mm" | "cm" | "px";
export type VectorMode = "logo" | "technical" | "silhouette" | "outline" | "precision" | "cnc";
export type OutputMode = "pixel" | "smooth" | "cad";
export type ImageQuality = "original" | "enhanced" | "ultra" | "ultra-pro" | "cad-clean" | "ai-enhance-3k" | "ai-enhance-4k";
export type LineProcessingMode = "manual" | "auto";
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

export interface Point { x: number; y: number }
export interface VectorPath { points: Point[]; closed: boolean; curved?: boolean; layer: "CONTOURS" | "DETAILS" | "GUIDES" }
export interface VectorDocument {
  width: number;
  height: number;
  unit: Unit;
  sourceWidth: number;
  sourceHeight: number;
  paths: VectorPath[];
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
}

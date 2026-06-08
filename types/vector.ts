export type Unit = "mm" | "cm" | "px";
export type VectorMode = "logo" | "technical" | "silhouette" | "outline" | "precision" | "cnc";

export interface Point { x: number; y: number }
export interface VectorPath { points: Point[]; closed: boolean; layer: "CONTOURS" | "DETAILS" | "GUIDES" }
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
  invert: boolean;
  removeNoise: boolean;
  smooth: boolean;
  edgeDetect: boolean;
}

export interface VectorSettings {
  mode: VectorMode;
  simplification: number;
  minArea: number;
  closePaths: boolean;
  joinDistance: number;
}

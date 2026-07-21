export type CadProjectType = "2d" | "3d";

export type CadProjectData = {
  notes: string;
  editorMode: "cad2d" | "cad3d";
  lastOpenedAt?: string;
  schemaVersion?: 1;
  sourceImageDataUrl?: string;
  sourceOriginalDataUrl?: string;
  sourceFormat?: "raster" | "tiff";
  fileName?: string;
  processing?: import("@/types/vector").ProcessingSettings;
  imageQuality?: import("@/types/vector").ImageQuality;
  tiffOptimizationEnabled?: boolean;
  imageAnalysis?: import("@/lib/image-processing/image-quality-analyzer").ImageQualityAnalysis;
  lineProcessingMode?: import("@/types/vector").LineProcessingMode;
  textDetectionEnabled?: boolean;
  detectedTexts?: import("@/types/vector").DetectedText[];
  aiAnalysis?: import("@/lib/ai/vectorcad-ai").VectorCadAiAnalysis;
  exportSmartTexts?: boolean;
  aiFeedback?: import("@/lib/ai/vectorcad-ai").AiFeedback[];
  vector?: import("@/types/vector").VectorSettings;
  document?: import("@/types/vector").VectorDocument | null;
  unit?: import("@/types/vector").Unit;
  realWidth?: number;
  realHeight?: number;
  locked?: boolean;
  activeView?: "original" | "processed" | "vector";
};

export type CadProject = {
  id: string;
  user_id: string;
  name: string;
  type: CadProjectType;
  data: CadProjectData | null;
  created_at: string;
  updated_at: string;
};

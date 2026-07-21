export type ViewerQualityMode = "performance" | "balanced" | "high";

export type ViewerQualityProfile = {
  label: string;
  maxPixelRatio: number;
  shadows: boolean;
  maxShadowVertices: number;
  description: string;
};

export const VIEWER_QUALITY_PROFILES: Record<ViewerQualityMode, ViewerQualityProfile> = {
  performance: {
    label: "Desempenho",
    maxPixelRatio: 1,
    shadows: false,
    maxShadowVertices: 0,
    description: "Menor consumo de GPU para projetos grandes.",
  },
  balanced: {
    label: "Equilibrado",
    maxPixelRatio: 1.5,
    shadows: true,
    maxShadowVertices: 150000,
    description: "Equilíbrio recomendado entre nitidez e fluidez.",
  },
  high: {
    label: "Alta qualidade",
    maxPixelRatio: 2,
    shadows: true,
    maxShadowVertices: 300000,
    description: "Mais nitidez e sombras para modelos moderados.",
  },
};

export type ViewerExportPreset = "screen" | "1920x1080" | "2560x1440" | "3840x2160";

export function getViewerPixelRatio(mode: ViewerQualityMode, devicePixelRatio = 1) {
  const profile = VIEWER_QUALITY_PROFILES[mode];
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(Math.max(dpr, 1), profile.maxPixelRatio);
}

export function getViewerExportResolution(
  preset: ViewerExportPreset,
  viewportWidth: number,
  viewportHeight: number,
) {
  if (preset === "screen") {
    return {
      width: Math.max(Math.round(viewportWidth), 1),
      height: Math.max(Math.round(viewportHeight), 1),
    };
  }

  const [width, height] = preset.split("x").map(Number);
  return {
    width: Number.isFinite(width) && width > 0 ? width : 1920,
    height: Number.isFinite(height) && height > 0 ? height : 1080,
  };
}

export function canExportViewerResolution(width: number, height: number, maxRenderbufferSize: number) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 0;
  const safeMax = Number.isFinite(maxRenderbufferSize) && maxRenderbufferSize > 0 ? maxRenderbufferSize : 0;
  return safeWidth > 0 && safeHeight > 0 && safeWidth <= safeMax && safeHeight <= safeMax && safeWidth * safeHeight <= 16_777_216;
}

export function sanitizeViewerFileName(value: string | undefined) {
  const name = (value || "vetorcad-projeto-3d")
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return name || "vetorcad-projeto-3d";
}


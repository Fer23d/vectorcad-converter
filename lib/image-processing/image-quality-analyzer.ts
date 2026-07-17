import type { ImageQuality } from "@/types/vector";

export type ImageQualityAnalysis = {
  qualityScore: number;
  resolutionScore: number;
  noiseLevel: "baixo" | "médio" | "alto";
  contrastLevel: "baixo" | "médio" | "alto";
  sharpnessLevel: "baixa" | "média" | "alta";
  recommendedMode: ImageQuality;
  confidence: number;
  width: number;
  height: number;
  dpi?: number;
  analyzedAt: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function level(value: number, labels: [string, string, string]) {
  return value < 40 ? labels[0] : value < 70 ? labels[1] : labels[2];
}

/** Lightweight raster inspection that samples pixels without creating a large working canvas. */
export class ImageQualityAnalyzer {
  analyze(image: ImageData, dpi?: number): ImageQualityAnalysis {
    const { width, height, data } = image;
    const stride = Math.max(1, Math.ceil(Math.sqrt((width * height) / 24000)));
    let samples = 0, sum = 0, sumSquared = 0, bright = 0, edgeSum = 0, isolatedDark = 0;
    for (let y = 0; y < height; y += stride) for (let x = 0; x < width; x += stride) {
      const offset = (y * width + x) * 4;
      const gray = data[offset] * .299 + data[offset + 1] * .587 + data[offset + 2] * .114;
      samples++; sum += gray; sumSquared += gray * gray;
      if (gray > 220) bright++;
      if (x >= stride && y >= stride) {
        const left = data[(y * width + x - stride) * 4];
        const above = data[((y - stride) * width + x) * 4];
        edgeSum += Math.abs(data[offset] - left) + Math.abs(data[offset] - above);
        if (gray < 100 && Math.abs(gray - left) > 35 && Math.abs(gray - above) > 35) isolatedDark++;
      }
    }
    const mean = samples ? sum / samples : 255;
    const deviation = Math.sqrt(Math.max(0, samples ? sumSquared / samples - mean * mean : 0));
    const contrastScore = clamp(deviation * 2.1 + bright / Math.max(1, samples) * 18);
    const sharpnessScore = clamp(edgeSum / Math.max(1, samples) * 1.4);
    const resolutionScore = clamp(Math.min(100, Math.sqrt(width * height) / 28 + (dpi && dpi >= 200 ? 25 : 0)));
    const noiseScore = clamp(isolatedDark / Math.max(1, samples) * 900 + (mean < 180 ? 10 : 0));
    const noiseLevel = level(noiseScore, ["baixo", "médio", "alto"]) as ImageQualityAnalysis["noiseLevel"];
    const contrastLevel = level(contrastScore, ["baixo", "médio", "alto"]) as ImageQualityAnalysis["contrastLevel"];
    const sharpnessLevel = level(sharpnessScore, ["baixa", "média", "alta"]) as ImageQualityAnalysis["sharpnessLevel"];
    const qualityScore = clamp(resolutionScore * .35 + contrastScore * .3 + sharpnessScore * .25 + (100 - noiseScore) * .1);
    const recommendedMode: ImageQuality = qualityScore >= 80 ? "original" : qualityScore >= 60 ? "cad-clean" : qualityScore >= 35 ? "ai-enhance-3k" : "ai-enhance-4k";
    return { qualityScore, resolutionScore, noiseLevel, contrastLevel, sharpnessLevel, recommendedMode, confidence: clamp(55 + Math.min(40, samples / 600)), width, height, dpi, analyzedAt: new Date().toISOString() };
  }
}

export const imageQualityAnalyzer = new ImageQualityAnalyzer();

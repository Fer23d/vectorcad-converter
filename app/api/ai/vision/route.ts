import { NextResponse } from "next/server";
import { logAiAnalysisDiagnostics, mergeAiAnalyses, MockProvider, offsetAiAnalysis, RealVisionProvider, runVectorCadAi } from "@/lib/ai/vectorcad-ai";
import { VisionObjectDetector } from "@/lib/ai/vision-object-detector";
import { createSupabaseAuthServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import type { DetectedText, VectorDocument } from "@/types/vector";

const MAX_IMAGE_DATA_URL_LENGTH = 16 * 1024 * 1024;
const MAX_VISION_REGIONS = 6;
const localProvider = new MockProvider();

type VisionRegion = {
  imageDataUrl: string;
  region: { x: number; y: number; width: number; height: number };
};

function bearerToken(request: Request) {
  const [type, token] = (request.headers.get("authorization") || "").split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

function shouldUseVision(texts: DetectedText[]) {
  if (!texts.length) return true;
  const confidence = texts.reduce((sum, text) => sum + (text.confidenceFinal ?? text.confidence), 0) / texts.length;
  return confidence < 0.7;
}

function isValidRegion(value: unknown): value is VisionRegion {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const region = candidate.region as Record<string, unknown> | null;
  return typeof candidate.imageDataUrl === "string" && candidate.imageDataUrl.startsWith("data:image/") && candidate.imageDataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH &&
    !!region && ["x", "y", "width", "height"].every((key) => typeof region[key] === "number" && Number.isFinite(region[key]) && Number(region[key]) >= 0) &&
    Number(region.width) > 0 && Number(region.height) > 0;
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ error: "Supabase server não configurado." }, { status: 500 });
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Sessão ausente." }, { status: 401 });
  const authClient = createSupabaseAuthServerClient(token);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    imageDataUrl?: unknown;
    regions?: unknown;
    ocrTexts?: DetectedText[];
    dimensions?: { width: number; height: number; unit: "mm" | "cm" | "px" } | null;
    vectors?: VectorDocument | null;
    context?: Record<string, unknown> | null;
  } | null;
  const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";
  const ocrTexts = Array.isArray(body?.ocrTexts) ? body.ocrTexts : [];
  const regions = Array.isArray(body?.regions) ? body.regions.filter(isValidRegion).slice(0, MAX_VISION_REGIONS) : [];
  if ((!imageDataUrl.startsWith("data:image/") && regions.length === 0) || imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    return NextResponse.json({ error: "Imagem para análise inválida ou muito grande." }, { status: 400 });
  }
  if (body?.regions && !Array.isArray(body.regions)) return NextResponse.json({ error: "Regiões de análise inválidas." }, { status: 400 });

  const baseImageDataUrl = regions[0]?.imageDataUrl || imageDataUrl;
  const baseInput = { imageDataUrl: baseImageDataUrl, ocrTexts, dimensions: body?.dimensions || null, vectors: body?.vectors || null, context: body?.context || null };
  const useVisionText = shouldUseVision(ocrTexts);
  const objectDetector = process.env.VISION_API_KEY ? new VisionObjectDetector() : undefined;
  console.info("[vetorcad][analysis] request", {
    ocrCount: ocrTexts.length,
    visionRegions: regions.length,
    regionBounds: regions.map((item) => item.region),
    regionPayloadBytes: regions.map((item) => item.imageDataUrl.length),
    useVisionText,
  });

  const local = await runVectorCadAi(baseInput, localProvider, useVisionText ? undefined : objectDetector);
  logAiAnalysisDiagnostics("OCR local", local);
  if (!useVisionText) {
    return NextResponse.json({ analysis: local, vision: { status: local.objectDetectionStatus === "executed" ? "executed" : "skipped", reason: local.objectDetectionStatus === "executed" ? "object_detection" : "ocr_confident" } });
  }

  try {
    const visionAnalyses = regions.length
      ? await Promise.allSettled(regions.map((item) => runVectorCadAi({ ...baseInput, imageDataUrl: item.imageDataUrl, region: item.region, ocrTexts: [] }, new RealVisionProvider(), objectDetector)))
      : await Promise.allSettled([runVectorCadAi(baseInput, new RealVisionProvider(), objectDetector)]);
    const successful = visionAnalyses.flatMap((result, index) => {
      if (result.status === "fulfilled") {
        const analysis = regions[index] ? offsetAiAnalysis(result.value, regions[index].region) : result.value;
        logAiAnalysisDiagnostics(`Vision ${regions[index] ? `região ${index + 1}` : "imagem"}`, analysis);
        return [analysis];
      }
      console.warn("[vetorcad][analysis] região Vision indisponível", { regionIndex: index, reason: result.reason instanceof Error ? result.reason.message : "VISION_UNKNOWN_ERROR" });
      return [];
    });
    if (!successful.length) throw new Error("VISION_ALL_REGIONS_FAILED");
    const analysis = mergeAiAnalyses(local, successful);
    logAiAnalysisDiagnostics("resultado híbrido", analysis);
    return NextResponse.json({ analysis, vision: { status: "executed", regionsAnalyzed: successful.length, regionsRequested: regions.length || 1 } });
  } catch (visionError) {
    const reason = visionError instanceof Error ? visionError.message : "VISION_UNKNOWN_ERROR";
    console.warn("[vetorcad][analysis] fallback para OCR local", { reason });
    const fallback = objectDetector ? await runVectorCadAi(baseInput, localProvider, objectDetector) : local;
    logAiAnalysisDiagnostics("fallback OCR", fallback);
    return NextResponse.json({ analysis: fallback, vision: { status: fallback.objectDetectionStatus === "executed" ? "executed" : "fallback", reason } });
  }
}

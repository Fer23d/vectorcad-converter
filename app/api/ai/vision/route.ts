import { NextResponse } from "next/server";
import { MockProvider, RealVisionProvider, runVectorCadAi } from "@/lib/ai/vectorcad-ai";
import { VisionObjectDetector } from "@/lib/ai/vision-object-detector";
import { createSupabaseAuthServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import type { DetectedText } from "@/types/vector";
import type { VectorDocument } from "@/types/vector";

const MAX_IMAGE_DATA_URL_LENGTH = 16 * 1024 * 1024;
const localProvider = new MockProvider();

function bearerToken(request: Request) {
  const [type, token] = (request.headers.get("authorization") || "").split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

function shouldUseVision(texts: DetectedText[]) {
  if (!texts.length) return true;
  const confidence = texts.reduce((sum, text) => sum + text.confidence, 0) / texts.length;
  return confidence < 0.7;
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
    ocrTexts?: DetectedText[];
    dimensions?: { width: number; height: number; unit: "mm" | "cm" | "px" } | null;
    vectors?: VectorDocument | null;
    context?: Record<string, unknown> | null;
  } | null;
  const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";
  const ocrTexts = Array.isArray(body?.ocrTexts) ? body.ocrTexts : [];
  if (!imageDataUrl.startsWith("data:image/") || imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    return NextResponse.json({ error: "Imagem para análise inválida ou muito grande." }, { status: 400 });
  }

  const input = { imageDataUrl, ocrTexts, dimensions: body?.dimensions || null, vectors: body?.vectors || null, context: body?.context || null };
  const useVisionText = shouldUseVision(ocrTexts);
  const objectDetector = process.env.VISION_API_KEY ? new VisionObjectDetector() : undefined;
  const local = await runVectorCadAi(input, localProvider, useVisionText ? undefined : objectDetector);
  if (!useVisionText) return NextResponse.json({ analysis: local, vision: { status: local.objectDetectionStatus === "executed" ? "executed" : "skipped", reason: local.objectDetectionStatus === "executed" ? "object_detection" : "ocr_confident" } });

  try {
    const vision = await runVectorCadAi(input, new RealVisionProvider(), objectDetector);
    return NextResponse.json({ analysis: { ...local, ...vision, objects: local.objects, dimensions: local.dimensions, provider: "hybrid-ocr-vision" }, vision: { status: "executed" } });
  } catch (visionError) {
    const reason = visionError instanceof Error ? visionError.message : "VISION_UNKNOWN_ERROR";
    console.warn("[VetorCAD][AI] Vision fallback para OCR local", { reason, userId: data.user.id });
    const fallback = objectDetector ? await runVectorCadAi(input, localProvider, objectDetector) : local;
    return NextResponse.json({ analysis: fallback, vision: { status: fallback.objectDetectionStatus === "executed" ? "executed" : "fallback", reason } });
  }
}

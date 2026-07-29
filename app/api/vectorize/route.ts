import { NextResponse } from "next/server";
import { vectorizeBitmap } from "@/lib/vectorize/contours";
import type { VectorSettings } from "@/types/vector";
import { isPayloadTooLarge, readJsonWithLimit, requireAuthenticatedUser } from "@/lib/security/request";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if ("response" in auth) return auth.response;
    const limit = await consumeRateLimit(`vectorize:${auth.user.id}`, 60, 60 * 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ error: "Muitas operações de vetorização. Aguarde e tente novamente." }, { status: 429 });
    const { bitmap, width, height, settings } = await readJsonWithLimit<{ bitmap: number[]; width: number; height: number; settings: VectorSettings }>(request, 24 * 1024 * 1024);
    if (!Array.isArray(bitmap) || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width > 4000 || height > 4000 || width * height > 4_000_000 || bitmap.length !== width * height || bitmap.some((value) => !Number.isFinite(value))) throw new Error();
    return NextResponse.json(vectorizeBitmap(Uint8Array.from(bitmap), width, height, settings));
  } catch (error) {
    const tooLarge = isPayloadTooLarge(error);
    return NextResponse.json({ error: tooLarge ? "Payload excede o limite seguro." : "Dados de vetorização inválidos." }, { status: tooLarge ? 413 : 400 });
  }
}

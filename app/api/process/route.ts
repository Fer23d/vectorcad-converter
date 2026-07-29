import { NextResponse } from "next/server";
import { isPayloadTooLarge, readJsonWithLimit, requireAuthenticatedUser } from "@/lib/security/request";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if ("response" in auth) return auth.response;
    const limit = await consumeRateLimit(`process:${auth.user.id}`, 120, 60 * 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ error: "Muitas operações de processamento. Aguarde e tente novamente." }, { status: 429 });
    const { pixels, threshold = 128, invert = false } = await readJsonWithLimit<{ pixels: number[]; threshold?: number; invert?: boolean }>(request, 24 * 1024 * 1024);
    if (!Array.isArray(pixels) || pixels.length > 4_000_000 || pixels.some((value) => !Number.isFinite(value))) throw new Error();
    const bitmap = pixels.map(value => (invert ? value > threshold : value < threshold) ? 1 : 0);
    return NextResponse.json({ bitmap });
  } catch (error) {
    const tooLarge = isPayloadTooLarge(error);
    return NextResponse.json({ error: tooLarge ? "Payload excede o limite seguro." : "Dados de processamento inválidos." }, { status: tooLarge ? 413 : 400 });
  }
}

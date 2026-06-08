import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { pixels, threshold = 128, invert = false } = await request.json() as { pixels: number[]; threshold?: number; invert?: boolean };
    if (!Array.isArray(pixels) || pixels.length > 4_000_000) throw new Error();
    const bitmap = pixels.map(value => (invert ? value > threshold : value < threshold) ? 1 : 0);
    return NextResponse.json({ bitmap });
  } catch { return NextResponse.json({ error: "Dados de processamento inválidos." }, { status: 400 }); }
}

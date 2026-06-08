import { NextResponse } from "next/server";
import { vectorizeBitmap } from "@/lib/vectorize/contours";
import type { VectorSettings } from "@/types/vector";

export async function POST(request: Request) {
  try {
    const { bitmap, width, height, settings } = await request.json() as { bitmap: number[]; width: number; height: number; settings: VectorSettings };
    if (!Array.isArray(bitmap) || !width || !height || bitmap.length !== width * height) throw new Error();
    return NextResponse.json(vectorizeBitmap(Uint8Array.from(bitmap), width, height, settings));
  } catch { return NextResponse.json({ error: "Dados de vetorização inválidos." }, { status: 400 }); }
}

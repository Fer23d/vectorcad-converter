import { generateSvg } from "@/lib/exporters/svg";
import type { VectorDocument } from "@/types/vector";
export async function POST(request: Request) {
  const doc = await request.json() as VectorDocument;
  return new Response(generateSvg(doc), { headers: { "Content-Type": "image/svg+xml", "Content-Disposition": "attachment; filename=vetorcad.svg" } });
}

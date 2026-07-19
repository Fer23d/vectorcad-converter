import { countDxfEntities, generateDxf } from "@/lib/exporters/dxf";
import type { VectorDocument } from "@/types/vector";
export async function POST(request: Request) {
  const doc = await request.json() as VectorDocument;
  if (!doc?.paths || countDxfEntities(doc) === 0) return Response.json({ error: "Nenhuma entidade CAD válida para exportar." }, { status: 400 });
  return new Response(generateDxf(doc), { headers: { "Content-Type": "application/dxf", "Content-Disposition": "attachment; filename=vetorcad.dxf" } });
}

import { countDxfEntities, generateDxf } from "@/lib/exporters/dxf";
import type { VectorDocument } from "@/types/vector";
import { readJsonWithLimit, requireAuthenticatedUser } from "@/lib/security/request";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;
  const limit = await consumeRateLimit(`export-dxf:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limit.allowed) return Response.json({ error: "Muitas exportações. Aguarde e tente novamente." }, { status: 429 });
  const doc = await readJsonWithLimit<VectorDocument>(request, 8 * 1024 * 1024);
  if (!doc?.paths || countDxfEntities(doc) === 0) return Response.json({ error: "Nenhuma entidade CAD válida para exportar." }, { status: 400 });
  return new Response(generateDxf(doc), { headers: { "Content-Type": "application/dxf", "Content-Disposition": "attachment; filename=vetorcad.dxf" } });
}

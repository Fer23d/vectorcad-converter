import { generateSvg } from "@/lib/exporters/svg";
import type { VectorDocument } from "@/types/vector";
import { readJsonWithLimit, requireAuthenticatedUser } from "@/lib/security/request";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;
  const limit = await consumeRateLimit(`export-svg:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limit.allowed) return Response.json({ error: "Muitas exportações. Aguarde e tente novamente." }, { status: 429 });
  const doc = await readJsonWithLimit<VectorDocument>(request, 8 * 1024 * 1024);
  return new Response(generateSvg(doc), { headers: { "Content-Type": "image/svg+xml", "Content-Disposition": "attachment; filename=vetorcad.svg" } });
}

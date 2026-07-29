import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/security/request";
import { consumeRateLimit, requestAddress } from "@/lib/security/rate-limit";
import { MAX_UPLOAD_BYTES, validateImageBuffer } from "@/lib/security/image-validation";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_UPLOAD_BYTES + 512 * 1024) return NextResponse.json({ error: "Arquivo excede 30 MB." }, { status: 413 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload inválido." }, { status: 400 });
  }
  const formProjectId = form.get("projectId");
  const projectId = (request.headers.get("x-project-id") || new URL(request.url).searchParams.get("projectId") || (typeof formProjectId === "string" ? formProjectId : "")).trim();
  const address = requestAddress(request);
  let userId = "public";
  if (projectId) {
    const auth = await requireAuthenticatedUser(request);
    if (auth.response) return auth.response;
    userId = auth.user.id;
    const token = (request.headers.get("authorization") || "").split(" ")[1] || "";
    const client = createSupabaseAuthServerClient(token);
    const { data: project, error } = await client.from("projects").select("id").eq("id", projectId).eq("user_id", userId).maybeSingle();
    if (error || !project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  }

  const limit = await consumeRateLimit(`upload:${userId}:${address}`, projectId ? 30 : 10, 60 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "Muitas tentativas de upload. Tente novamente mais tarde." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

  try {
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Arquivo excede 30 MB." }, { status: 413 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const metadata = await validateImageBuffer(buffer);
    return NextResponse.json({ ok: true, name: file.name, type: metadata.mimeType, size: file.size, width: metadata.width, height: metadata.height });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_IMAGE";
    const status = code === "IMAGE_TOO_LARGE" || code === "IMAGE_DIMENSIONS_TOO_LARGE" ? 413 : 415;
    return NextResponse.json({ error: status === 413 ? "Imagem excede os limites permitidos." : "Arquivo de imagem inválido ou corrompido." }, { status });
  }
}

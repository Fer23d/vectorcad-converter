import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server";

function bearerToken(request: Request) {
  const [type, token] = (request.headers.get("authorization") || "").split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

export async function requireAuthenticatedUser(request: Request) {
  if (!isSupabaseServerConfigured) return { response: NextResponse.json({ error: "Supabase server não configurado." }, { status: 500 }) };
  const token = bearerToken(request);
  if (!token) return { response: NextResponse.json({ error: "Sessão ausente." }, { status: 401 }) };
  const client = createSupabaseAuthServerClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { response: NextResponse.json({ error: "Sessão inválida." }, { status: 401 }) };
  if (!data.user.email_confirmed_at) return { response: NextResponse.json({ error: "E-mail não confirmado." }, { status: 403 }) };
  return { user: data.user };
}

export async function readJsonWithLimit<T>(request: Request, maxBytes: number): Promise<T> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  return JSON.parse(text) as T;
}

export function isPayloadTooLarge(error: unknown) {
  return error instanceof Error && error.message === "PAYLOAD_TOO_LARGE";
}

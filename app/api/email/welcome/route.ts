import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/resend";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: "Supabase nao configurado." }, { status: 500 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Sessao ausente." }, { status: 401 });
  }

  const authClient = createSupabaseAuthServerClient(token);
  const { data, error } = await authClient.auth.getUser(token);
  const user = data.user;

  if (error || !user?.email) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }

  const firstName = String(user.user_metadata?.first_name || "").trim();
  const lastName = String(user.user_metadata?.last_name || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Usuario VectorCAD";

  try {
    const payload = await sendWelcomeEmail({ to: user.email, name: fullName });
    return NextResponse.json({ ok: true, id: payload?.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nao foi possivel enviar email." }, { status: 500 });
  }
}

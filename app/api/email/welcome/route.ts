import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server";

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

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (!resendApiKey) {
    return NextResponse.json({ error: "Configure RESEND_API_KEY para enviar emails." }, { status: 500 });
  }

  const firstName = String(user.user_metadata?.first_name || "").trim();
  const lastName = String(user.user_metadata?.last_name || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Usuario VectorCAD";
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "VectorCAD <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [user.email],
      subject: "Bem-vindo ao VectorCAD",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#142018">
          <h1 style="margin:0 0 12px;font-size:28px">Bem-vindo ao VectorCAD, ${fullName}.</h1>
          <p style="font-size:16px;line-height:1.6;color:#435047">
            Sua conta foi criada com sucesso e ja esta ativa. Voce ja pode converter imagens em SVG/DXF, organizar projetos e usar o editor CAD.
          </p>
          <a href="https://vectorcad-converter.vercel.app/dashboard" style="display:inline-block;margin-top:18px;background:#b7f34a;color:#09120d;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">
            Abrir VectorCAD
          </a>
        </div>
      `,
      text: `Bem-vindo ao VectorCAD, ${fullName}. Sua conta foi criada com sucesso e ja esta ativa.`,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({ error: payload.message || "Nao foi possivel enviar email." }, { status: response.status });
  }

  return NextResponse.json({ ok: true, id: payload.id });
}

import { NextResponse } from "next/server";

const accepted = ["image/png", "image/jpeg", "image/webp"];
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
  if (!accepted.includes(file.type)) return NextResponse.json({ error: "Formato inválido." }, { status: 415 });
  if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Arquivo excede 12 MB." }, { status: 413 });
  return NextResponse.json({ ok: true, name: file.name, type: file.type, size: file.size });
}

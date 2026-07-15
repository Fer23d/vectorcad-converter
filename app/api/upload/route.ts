import { NextResponse } from "next/server";

const accepted = ["image/png", "image/jpeg", "image/webp", "image/tiff", "image/x-tiff"];
const MAX_FILE_SIZE = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });

  const extension = file.name.toLowerCase().split(".").pop();
  const isTiff = file.type === "image/tiff" || file.type === "image/x-tiff" || extension === "tif" || extension === "tiff";
  if (!accepted.includes(file.type) && !isTiff) return NextResponse.json({ error: "Formato inválido." }, { status: 415 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Arquivo excede 12 MB." }, { status: 413 });

  return NextResponse.json({ ok: true, name: file.name, type: isTiff ? "image/tiff" : file.type, size: file.size });
}

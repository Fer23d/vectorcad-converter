import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminAuth = await requireAdmin(request);
  if ("response" in adminAuth) return adminAuth.response;

  const { id } = await params;
  const { error } = await adminAuth.adminClient.from("projects").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

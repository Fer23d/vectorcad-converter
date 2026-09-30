import { NextResponse } from "next/server";
import { getUserRole, isAdminRole } from "@/lib/admin";
import { deleteUserPermanently, logAdminAction } from "@/lib/admin-user-management";
import { requireAdminWithMFA } from "@/lib/admin-auth";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminAuth = await requireAdminWithMFA(request);
  if ("response" in adminAuth) return adminAuth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.confirmation !== "EXCLUIR") {
    return NextResponse.json({ error: "Digite EXCLUIR para confirmar a exclusão permanente." }, { status: 400 });
  }

  if (id === adminAuth.user.id) {
    return NextResponse.json({ error: "Um administrador não pode excluir o próprio usuário." }, { status: 400 });
  }

  const { data, error } = await adminAuth.adminClient.auth.admin.getUserById(id);
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message || "Usuário não encontrado." }, { status: 404 });
  }

  const { data: targetRole, error: roleError } = await adminAuth.adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", id)
    .maybeSingle();
  if (roleError) return NextResponse.json({ error: "Não foi possível validar o perfil do usuário." }, { status: 500 });
  if (isAdminRole(getUserRole(targetRole?.role))) {
    return NextResponse.json({ error: "Remova a permissão ADMIN antes de excluir outro administrador." }, { status: 400 });
  }

  try {
    const result = await deleteUserPermanently(adminAuth.adminClient, data.user);
    await logAdminAction(adminAuth.adminClient, adminAuth.user.id, "user.delete_permanently", "user", id, {
      email: data.user.email || null,
      projectCount: result.projectCount,
      storageObjectsDeleted: result.storageObjectsDeleted,
    });
    return NextResponse.json({ ok: true, id, ...result });
  } catch (deleteError) {
    await logAdminAction(adminAuth.adminClient, adminAuth.user.id, "user.delete_permanently_failed", "user", id, {
      reason: deleteError instanceof Error ? deleteError.message : "unknown",
    }).catch(() => null);
    return NextResponse.json({ error: "Não foi possível concluir a exclusão permanente com segurança." }, { status: 500 });
  }
}

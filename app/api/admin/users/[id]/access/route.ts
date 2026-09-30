import { NextResponse } from "next/server";
import { requireAdminWithMFA } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-user-management";
import { normalizeUserAccessStatus, setUserAccessStatus, type UserAccessStatus } from "@/lib/user-access";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminAuth = await requireAdminWithMFA(request);
  if ("response" in adminAuth) return adminAuth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = normalizeUserAccessStatus(body.status) as UserAccessStatus;

  if (body.status !== "active" && body.status !== "blocked") {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  if (id === adminAuth.user.id && status === "blocked") {
    return NextResponse.json({ error: "Um administrador não pode revogar o próprio acesso." }, { status: 400 });
  }

  const { data, error } = await adminAuth.adminClient.auth.admin.getUserById(id);
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message || "Usuário não encontrado." }, { status: 404 });
  }

  await setUserAccessStatus(adminAuth.adminClient, data.user, status);
  await logAdminAction(
    adminAuth.adminClient,
    adminAuth.user.id,
    status === "blocked" ? "user.access_revoked" : "user.access_restored",
    "user",
    id,
    { email: data.user.email || null, status },
  );

  return NextResponse.json({ ok: true, id, status });
}

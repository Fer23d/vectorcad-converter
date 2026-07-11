import { NextResponse } from "next/server";
import { normalizeCompanyPlan } from "@/lib/access-control";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function logAdminAction(adminClient: ReturnType<typeof createSupabaseAdminClient>, adminId: string, action: string, targetType: string, targetId: string, metadata: Record<string, unknown> = {}) {
  const { error } = await adminClient.from("admin_logs").insert([{ admin_id: adminId, action, target_type: targetType, target_id: targetId, metadata }]);
  if (error && error.code !== "42P01") throw error;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminAuth = await requireAdmin(request);
  if ("response" in adminAuth) return adminAuth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const plan = normalizeCompanyPlan(typeof body.plan === "string" ? body.plan : "free");
  const name = typeof body.name === "string" ? body.name.trim() : decodeURIComponent(id);
  const { adminClient, user } = adminAuth;

  const filteredQuery = isUuid(id)
    ? adminClient.from("companies").update({ plan, updated_at: new Date().toISOString() }).eq("id", id)
    : adminClient.from("companies").update({ plan, updated_at: new Date().toISOString() }).eq("name", name);

  const { data, error } = await filteredQuery.select("id,name,plan,created_at,updated_at").single();

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ error: "Tabela companies não existe. Execute supabase/enterprise.sql no Supabase." }, { status: 500 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction(adminClient, user.id, "company.plan_update", "company", data.id, { name: data.name, plan });

  return NextResponse.json({ ...data, plan });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminAuth = await requireAdmin(request);
  if ("response" in adminAuth) return adminAuth.response;

  const { id } = await params;
  const { adminClient, user } = adminAuth;
  const companyQuery = isUuid(id)
    ? adminClient.from("companies").select("id,name,plan").eq("id", id)
    : adminClient.from("companies").select("id,name,plan").eq("name", decodeURIComponent(id));
  const { data: company, error: companyError } = await companyQuery.single();

  if (companyError || !company) {
    return NextResponse.json({ error: companyError?.message || "Empresa não encontrada." }, { status: 404 });
  }

  const affectedUserIds = new Set<string>();
  const { data: membershipUsers, error: membershipUsersError } = await adminClient
    .from("companies_users")
    .select("user_id")
    .eq("company_name", company.name);

  if (membershipUsersError && membershipUsersError.code !== "42P01" && membershipUsersError.code !== "PGRST205") {
    return NextResponse.json({ error: membershipUsersError.message }, { status: 500 });
  }

  for (const row of membershipUsers || []) {
    if (row.user_id) affectedUserIds.add(row.user_id);
  }

  const { data: profileUsersByName, error: profileUsersByNameError } = await adminClient.from("profiles").select("user_id").eq("company", company.name);
  if (profileUsersByNameError && profileUsersByNameError.code !== "42P01") {
    return NextResponse.json({ error: profileUsersByNameError.message }, { status: 500 });
  }

  const { data: profileUsersById, error: profileUsersByIdError } = await adminClient.from("profiles").select("user_id").eq("company", company.id);
  if (profileUsersByIdError && profileUsersByIdError.code !== "42P01") {
    return NextResponse.json({ error: profileUsersByIdError.message }, { status: 500 });
  }

  for (const row of [...(profileUsersByName || []), ...(profileUsersById || [])]) {
    if (row.user_id) affectedUserIds.add(row.user_id);
  }

  const { data: authUsers } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const authUser of authUsers.users) {
    const metadataCompany = String(authUser.user_metadata?.company || "");
    if (metadataCompany === company.name || metadataCompany === company.id) {
      affectedUserIds.add(authUser.id);
    }
  }

  for (const userId of affectedUserIds) {
    const { data: userData } = await adminClient.auth.admin.getUserById(userId);
    if (!userData.user) continue;
    await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: { ...(userData.user.user_metadata || {}), company: null },
    });
  }

  const nullCompanyUpdate = { company: null, updated_at: new Date().toISOString() };
  const { error: profilesByNameError } = await adminClient.from("profiles").update(nullCompanyUpdate).eq("company", company.name);
  if (profilesByNameError && profilesByNameError.code !== "42P01") {
    return NextResponse.json({ error: profilesByNameError.message }, { status: 500 });
  }

  const { error: profilesByIdError } = await adminClient.from("profiles").update(nullCompanyUpdate).eq("company", company.id);
  if (profilesByIdError && profilesByIdError.code !== "42P01") {
    return NextResponse.json({ error: profilesByIdError.message }, { status: 500 });
  }

  const { error: usersByNameError } = await adminClient.from("users").update(nullCompanyUpdate).eq("company", company.name);
  if (usersByNameError && usersByNameError.code !== "42P01") {
    return NextResponse.json({ error: usersByNameError.message }, { status: 500 });
  }

  const { error: usersByIdError } = await adminClient.from("users").update(nullCompanyUpdate).eq("company", company.id);
  if (usersByIdError && usersByIdError.code !== "42P01") {
    return NextResponse.json({ error: usersByIdError.message }, { status: 500 });
  }

  const { error: membershipDeleteError } = await adminClient.from("companies_users").delete().eq("company_name", company.name);
  if (membershipDeleteError && membershipDeleteError.code !== "42P01" && membershipDeleteError.code !== "PGRST205") {
    return NextResponse.json({ error: membershipDeleteError.message }, { status: 500 });
  }

  const { error: deleteError } = await adminClient.from("companies").delete().eq("id", company.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  await logAdminAction(adminClient, user.id, "company.delete", "company", company.id, { name: company.name, plan: company.plan });

  return NextResponse.json({ success: true, company });
}

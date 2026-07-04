import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { isPremiumCompany, normalizeCompany, normalizeCompanyPlan, planHasPremiumAccess, resolveUserPlan } from "@/lib/access-control";
import { createSupabaseAdminClient, createSupabaseAuthServerClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

async function logAdminAction(adminClient: ReturnType<typeof createSupabaseAdminClient>, adminId: string, action: string, targetType: string, targetId: string, metadata: Record<string, unknown> = {}) {
  const { error } = await adminClient.from("admin_logs").insert([{ admin_id: adminId, action, target_type: targetType, target_id: targetId, metadata }]);
  if (error && error.code !== "42P01") throw error;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: "Supabase nao configurado." }, { status: 500 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Sessao ausente." }, { status: 401 });
  }

  const authClient = createSupabaseAuthServerClient(token);
  const { data: adminData, error: adminError } = await authClient.auth.getUser(token);

  if (adminError || !adminData.user) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }

  if (!isAdminUser(adminData.user.id)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Configure SUPABASE_SERVICE_ROLE_KEY para ativar o painel admin." }, { status: 500 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const requestedCompany = normalizeCompany(typeof body.company === "string" ? body.company : null);
  const company = isPremiumCompany(requestedCompany) ? "SM&A" : null;
  const adminClient = createSupabaseAdminClient();

  const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(id);
  if (userError || !userData.user) {
    return NextResponse.json({ error: userError?.message || "Usuario nao encontrado." }, { status: 404 });
  }

  const existingMetadata = userData.user.user_metadata || {};
  const { error: metadataError } = await adminClient.auth.admin.updateUserById(id, {
    user_metadata: { ...existingMetadata, company },
  });

  if (metadataError) {
    return NextResponse.json({ error: metadataError.message }, { status: 500 });
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert({
      user_id: id,
      name: existingMetadata.first_name || null,
      surname: existingMetadata.last_name || null,
      company,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (profileError && profileError.code !== "42P01") {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const billingPlan = normalizeCompanyPlan(String(existingMetadata.plan || "free"));
  const effectivePlan = resolveUserPlan({ company, plan: billingPlan, is_premium: Boolean(existingMetadata.is_premium) });
  const { error: publicUserError } = await adminClient
    .from("users")
    .upsert({
      id,
      email: userData.user.email || null,
      company,
      is_premium: Boolean(existingMetadata.is_premium) || planHasPremiumAccess(billingPlan),
      plan: billingPlan,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

  if (publicUserError && publicUserError.code !== "42P01" && publicUserError.code !== "42703" && publicUserError.code !== "PGRST205") {
    return NextResponse.json({ error: publicUserError.message }, { status: 500 });
  }

  await logAdminAction(
    adminClient,
    adminData.user.id,
    company ? "user.company_add" : "user.company_remove",
    "user",
    id,
    { email: userData.user.email, company },
  );

  return NextResponse.json({
    id,
    company,
    plan: effectivePlan,
    premium: planHasPremiumAccess(effectivePlan),
  });
}

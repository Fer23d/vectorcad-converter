import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { normalizeCompany, normalizeCompanyPlan } from "@/lib/access-control";
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

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({}));
  const name = normalizeCompany(typeof body.name === "string" ? body.name : null);
  const plan = normalizeCompanyPlan(typeof body.plan === "string" ? body.plan : "free");

  if (!name) {
    return NextResponse.json({ error: "Nome da empresa e obrigatorio." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("companies")
    .insert([{ name, plan }])
    .select("id,name,plan,created_at,updated_at")
    .single();

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ error: "Tabela companies nao existe. Execute supabase/enterprise.sql no Supabase." }, { status: 500 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction(adminClient, adminData.user.id, "company.create", "company", data.id, { name, plan });

  return NextResponse.json({
    ...data,
    plan,
    user_count: 0,
    premium_users: 0,
  });
}

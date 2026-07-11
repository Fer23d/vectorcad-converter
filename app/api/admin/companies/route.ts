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

function isMissingCompaniesTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() || "";
  return error.code === "42P01" || error.code === "PGRST205" || message.includes("schema cache") || message.includes("could not find the table") || message.includes("relation") && message.includes("companies") && message.includes("does not exist");
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseServerConfigured) {
      return NextResponse.json({ success: false, error: "Supabase não configurado." }, { status: 500 });
    }

    const token = bearerToken(request);
    if (!token) {
      return NextResponse.json({ success: false, error: "Sessão ausente." }, { status: 401 });
    }

    const authClient = createSupabaseAuthServerClient(token);
    const { data: adminData, error: adminError } = await authClient.auth.getUser(token);

    if (adminError || !adminData.user) {
      return NextResponse.json({ success: false, error: "Sessão inválida." }, { status: 401 });
    }

    if (!isAdminUser(adminData.user.id)) {
      return NextResponse.json({ success: false, error: "Acesso negado." }, { status: 403 });
    }

    if (!isSupabaseAdminConfigured) {
      return NextResponse.json({ success: false, error: "Configure SUPABASE_SERVICE_ROLE_KEY para ativar o painel admin." }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    console.log("[admin/companies] request body", body);

    const name = normalizeCompany(typeof body.name === "string" ? body.name : null);
    const plan = normalizeCompanyPlan(typeof body.plan === "string" ? body.plan : "free");

    if (!name) {
      return NextResponse.json({ success: false, error: "Nome da empresa e obrigatorio." }, { status: 400 });
    }

    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient
      .from("companies")
      .insert([{ name, plan, created_at: new Date().toISOString() }])
      .select("id,name,plan,created_at,updated_at")
      .single();

    console.log("[admin/companies] supabase insert", { data, error });

    if (error) {
      if (isMissingCompaniesTable(error)) {
        return NextResponse.json({
          success: false,
          error: "Tabela companies não existe ou não está no schema cache. Execute supabase/enterprise.sql no SQL Editor do Supabase e tente novamente.",
        }, { status: 500 });
      }

      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    try {
      await logAdminAction(adminClient, adminData.user.id, "company.create", "company", data.id, { name, plan });
    } catch (logError) {
      console.error("[admin/companies] failed to write admin log", logError);
    }

    return NextResponse.json({
      success: true,
      company: {
        ...data,
        plan,
        user_count: 0,
        premium_users: 0,
      },
    });
  } catch (error) {
    console.error("[admin/companies] unexpected error", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Erro inesperado ao criar empresa.",
    }, { status: 500 });
  }
}

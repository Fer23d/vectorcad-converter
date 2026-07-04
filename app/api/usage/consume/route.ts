import { NextResponse } from "next/server";
import { daily3dLimitForPlan, dailyUsageLimitForPlan, normalizeCompanyPlan, planAllowsDxf, planAllowsUnlimited3d, planHasPremiumAccess, planRemovesAds, resolveUserPlan } from "@/lib/access-control";
import { createSupabaseAdminClient, createSupabaseAuthServerClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";

type UsageAction = "vectorize" | "export3d" | "export_dxf";
type UsageProfileRow = {
  user_id?: string;
  company?: string | null;
  plan?: string | null;
  is_premium?: boolean | null;
  usage_count_today?: number | null;
  export3d_count_today?: number | null;
  last_usage_reset?: string | null;
};

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function sameDay(value?: string | null) {
  return Boolean(value && value.slice(0, 10) === todayKey());
}

function isMissingTableOrColumn(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() || "";
  return error.code === "42P01" || error.code === "42703" || error.code === "PGRST205" || message.includes("schema cache");
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: "Supabase nao configurado." }, { status: 500 });
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Configure SUPABASE_SERVICE_ROLE_KEY para controlar limites." }, { status: 500 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Faca login para usar o VectorCAD." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "vectorize") as UsageAction;
  if (!["vectorize", "export3d", "export_dxf"].includes(action)) {
    return NextResponse.json({ error: "Acao de uso invalida." }, { status: 400 });
  }

  const authClient = createSupabaseAuthServerClient(token);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user?.email) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }

  const adminClient = createSupabaseAdminClient();
  const user = userData.user;
  const { data: profileRow, error: profileError } = await adminClient
    .from("profiles")
    .select("user_id,company,plan,is_premium,usage_count_today,export3d_count_today,last_usage_reset")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError && !isMissingTableOrColumn(profileError)) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const profile = (profileRow || {}) as UsageProfileRow;
  const company = typeof profile.company === "string" ? profile.company : String(user.user_metadata?.company || "");
  const basePlan = normalizeCompanyPlan(String(profile.plan || user.user_metadata?.plan || "free"));
  const plan = resolveUserPlan({ company, plan: basePlan, is_premium: Boolean(profile.is_premium || user.user_metadata?.is_premium) });

  const reset = !sameDay(profile.last_usage_reset);
  const currentUsage = reset ? 0 : Number(profile.usage_count_today || 0);
  const current3d = reset ? 0 : Number(profile.export3d_count_today || 0);
  const usageLimit = dailyUsageLimitForPlan(plan);
  const export3dLimit = daily3dLimitForPlan(plan);

  if (action === "export_dxf" && !planAllowsDxf(plan)) {
    return NextResponse.json({ error: "Exportacao DXF completa e recurso do plano PRO ou EMPRESARIAL.", plan, usage: currentUsage, usageLimit }, { status: 402 });
  }

  if (action === "export3d") {
    if (export3dLimit === 0) {
      return NextResponse.json({ error: "Exportacao 3D nao esta disponivel no plano FREE.", plan, export3d: current3d, export3dLimit }, { status: 402 });
    }

    if (export3dLimit !== null && current3d >= export3dLimit) {
      return NextResponse.json({ error: "Limite diario de exportacao 3D atingido. Faca upgrade para PRO.", plan, export3d: current3d, export3dLimit }, { status: 402 });
    }
  }

  if (action === "vectorize" && usageLimit !== null && currentUsage >= usageLimit) {
    return NextResponse.json({ error: "Limite diario atingido. Faca upgrade para continuar convertendo hoje.", plan, usage: currentUsage, usageLimit }, { status: 402 });
  }

  const nextUsage = action === "vectorize" ? currentUsage + 1 : currentUsage;
  const next3d = action === "export3d" ? current3d + 1 : current3d;
  const updates = {
    user_id: user.id,
    plan: basePlan,
    is_premium: planHasPremiumAccess(basePlan) || Boolean(profile.is_premium || user.user_metadata?.is_premium),
    usage_count_today: nextUsage,
    export3d_count_today: next3d,
    last_usage_reset: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await adminClient.from("profiles").upsert(updates, { onConflict: "user_id" });
  if (updateError && !isMissingTableOrColumn(updateError)) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await adminClient.from("users").upsert({
    id: user.id,
    email: user.email,
    company: company || null,
    plan: basePlan,
    is_premium: updates.is_premium,
    usage_count_today: nextUsage,
    export3d_count_today: next3d,
    last_usage_reset: updates.last_usage_reset,
    updated_at: updates.updated_at,
  }, { onConflict: "id" }).then(({ error }) => {
    if (error && !isMissingTableOrColumn(error)) console.error("[usage] public users sync failed", error);
  });

  return NextResponse.json({
    ok: true,
    plan,
    usage: nextUsage,
    usageLimit,
    export3d: next3d,
    export3dLimit,
    adsVisible: !planRemovesAds(plan),
    dxfAllowed: planAllowsDxf(plan),
    unlimited3d: planAllowsUnlimited3d(plan),
  });
}

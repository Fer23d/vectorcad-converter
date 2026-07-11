import { NextResponse } from "next/server";
import { daily3dLimitForPlan, dailyUsageLimitForPlan, planAllowsDxf, planAllowsUnlimited3d, planHasPremiumAccess, planRemovesAds } from "@/lib/access-control";
import { getUserEffectivePlan } from "@/lib/effective-plan";
import { sendDailyLimitReachedEmail } from "@/lib/resend";
import { createSupabaseAdminClient, createSupabaseAuthServerClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";

type UsageAction = "vectorize" | "export_svg" | "export_png" | "export3d" | "export_dxf";
type UsageProfileRow = {
  user_id?: string;
  company?: string | null;
  company_id?: string | null;
  plan?: string | null;
  is_premium?: boolean | null;
  usage_count_today?: number | null;
  export3d_count_today?: number | null;
  last_usage_reset?: string | null;
};

const USAGE_ACTIONS: UsageAction[] = ["vectorize", "export_svg", "export_png", "export3d", "export_dxf"];
const DAILY_USAGE_ACTIONS: UsageAction[] = ["vectorize", "export_svg", "export_png"];

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

function limitMessage(limit: number) {
  return `Você atingiu o limite diário de ${limit} usos. Faça upgrade para continuar.`;
}

function fullName(metadata: Record<string, unknown> | undefined) {
  const firstName = String(metadata?.first_name || "").trim();
  const lastName = String(metadata?.last_name || "").trim();
  return [firstName, lastName].filter(Boolean).join(" ");
}

function isMissingTableOrColumn(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() || "";
  return error.code === "42P01" || error.code === "42703" || error.code === "PGRST205" || message.includes("schema cache");
}

async function getUsageContext(request: Request) {
  if (!isSupabaseServerConfigured) {
    return { response: NextResponse.json({ error: "Supabase não configurado." }, { status: 500 }) };
  }

  if (!isSupabaseAdminConfigured) {
    return { response: NextResponse.json({ error: "Configure SUPABASE_SERVICE_ROLE_KEY para controlar limites." }, { status: 500 }) };
  }

  const token = bearerToken(request);
  if (!token) {
    return { response: NextResponse.json({ error: "Faça login para usar o VectorCAD." }, { status: 401 }) };
  }

  const authClient = createSupabaseAuthServerClient(token);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user?.email) {
    return { response: NextResponse.json({ error: "Sessão inválida." }, { status: 401 }) };
  }

  const adminClient = createSupabaseAdminClient();
  const user = userData.user;
  if (!user.email_confirmed_at) {
    return { response: NextResponse.json({ error: "Confirme seu e-mail para usar o VectorCAD." }, { status: 403 }) };
  }

  const { data: profileRow, error: profileError } = await adminClient
    .from("profiles")
    .select("user_id,company,company_id,plan,is_premium,usage_count_today,export3d_count_today,last_usage_reset")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError && !isMissingTableOrColumn(profileError)) {
    return { response: NextResponse.json({ error: profileError.message }, { status: 500 }) };
  }

  const profile = (profileRow || {}) as UsageProfileRow;
  const effective = await getUserEffectivePlan(adminClient, user.id, { user, profile });
  const reset = !sameDay(profile.last_usage_reset);
  const currentUsage = reset ? 0 : Number(profile.usage_count_today || 0);
  const current3d = reset ? 0 : Number(profile.export3d_count_today || 0);
  const usageLimit = dailyUsageLimitForPlan(effective.plan);
  const export3dLimit = daily3dLimitForPlan(effective.plan);
  const now = new Date().toISOString();

  return {
    adminClient,
    basePlan: effective.individualPlan,
    company: effective.company,
    companyId: effective.companyId,
    current3d,
    currentUsage,
    effective,
    export3dLimit,
    plan: effective.plan,
    profile,
    reset,
    usageLimit,
    user,
    now,
  };
}

type UsageContext = Exclude<Awaited<ReturnType<typeof getUsageContext>>, { response: NextResponse }>;

function usagePayload(context: UsageContext, usage: number, export3d: number) {
  return {
    ok: true,
    plan: context.plan,
    usage,
    usageLimit: context.usageLimit,
    export3d,
    export3dLimit: context.export3dLimit,
    company: context.company,
    company_id: context.companyId,
    planSource: context.effective.source,
    adsVisible: !planRemovesAds(context.plan),
    dxfAllowed: planAllowsDxf(context.plan),
    unlimited3d: planAllowsUnlimited3d(context.plan),
  };
}

async function persistUsage(context: UsageContext, usage: number, export3d: number) {
  const updates = {
    user_id: context.user.id,
    plan: context.basePlan,
    is_premium: planHasPremiumAccess(context.basePlan) || Boolean(context.profile.is_premium || context.user.user_metadata?.is_premium),
    usage_count_today: usage,
    export3d_count_today: export3d,
    last_usage_reset: context.now,
    updated_at: context.now,
  };

  const { error: updateError } = await context.adminClient.from("profiles").upsert(updates, { onConflict: "user_id" });
  if (updateError && !isMissingTableOrColumn(updateError)) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const publicUserPayload = {
    id: context.user.id,
    email: context.user.email,
    company: context.company || null,
    company_id: context.companyId || null,
    plan: context.basePlan,
    is_premium: updates.is_premium,
    usage_count_today: usage,
    export3d_count_today: export3d,
    last_usage_reset: updates.last_usage_reset,
    updated_at: updates.updated_at,
  };

  await context.adminClient.from("users").upsert(publicUserPayload, { onConflict: "id" }).then(async ({ error }) => {
    if (error && isMissingTableOrColumn(error)) {
      const fallbackPayload: Record<string, unknown> = { ...publicUserPayload };
      delete fallbackPayload.company_id;
      await context.adminClient.from("users").upsert(fallbackPayload, { onConflict: "id" });
      return;
    }
    if (error) console.error("[usage] public users sync failed", error);
  });

  return null;
}

export async function GET(request: Request) {
  const context = await getUsageContext(request);
  if ("response" in context) return context.response;

  if (context.reset) {
    const errorResponse = await persistUsage(context, 0, 0);
    if (errorResponse) return errorResponse;
    return NextResponse.json(usagePayload(context, 0, 0));
  }

  return NextResponse.json(usagePayload(context, context.currentUsage, context.current3d));
}

export async function POST(request: Request) {
  const context = await getUsageContext(request);
  if ("response" in context) return context.response;

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "vectorize") as UsageAction;
  if (!USAGE_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Ação de uso inválida." }, { status: 400 });
  }

  if (context.usageLimit !== null && DAILY_USAGE_ACTIONS.includes(action) && context.currentUsage >= context.usageLimit) {
    return NextResponse.json({ error: limitMessage(context.usageLimit), plan: context.plan, usage: context.currentUsage, usageLimit: context.usageLimit }, { status: 402 });
  }

  if (action === "export_dxf" && !planAllowsDxf(context.plan)) {
    return NextResponse.json({ error: "Exportação DXF completa é recurso do plano PRO ou EMPRESARIAL.", plan: context.plan, usage: context.currentUsage, usageLimit: context.usageLimit }, { status: 402 });
  }

  if (action === "export3d") {
    if (context.export3dLimit === 0) {
      return NextResponse.json({ error: "Exportação 3D não está disponível no plano FREE.", plan: context.plan, export3d: context.current3d, export3dLimit: context.export3dLimit }, { status: 402 });
    }

    if (context.export3dLimit !== null && context.current3d >= context.export3dLimit) {
      return NextResponse.json({ error: "Limite diário de exportação 3D atingido. Faça upgrade para PRO.", plan: context.plan, export3d: context.current3d, export3dLimit: context.export3dLimit }, { status: 402 });
    }
  }

  const nextUsage = DAILY_USAGE_ACTIONS.includes(action) ? context.currentUsage + 1 : context.currentUsage;
  const next3d = action === "export3d" ? context.current3d + 1 : context.current3d;
  const errorResponse = await persistUsage(context, nextUsage, next3d);
  if (errorResponse) return errorResponse;

  if (context.plan === "free" && context.usageLimit !== null && nextUsage === context.usageLimit && context.user.email) {
    sendDailyLimitReachedEmail({
      to: context.user.email,
      name: fullName(context.user.user_metadata as Record<string, unknown> | undefined),
      used: nextUsage,
      limit: context.usageLimit,
    }).catch((error) => console.error("[usage] daily limit email failed", error));
  }

  return NextResponse.json(usagePayload(context, nextUsage, next3d));
}

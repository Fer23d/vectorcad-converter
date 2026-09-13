import { NextResponse } from "next/server";
import { buildAcademyProgress, completeAcademyStep, isAcademyStepUnlocked } from "@/lib/academy/progress";
import { getAcademySteps } from "@/lib/academy/modules";
import { createSupabaseAdminClient, createSupabaseAuthServerClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";

type AcademyProgressRow = {
  user_id: string;
  completed_steps: string[] | null;
  current_step_id: string | null;
  updated_at?: string | null;
};

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

function isMissingAcademyTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() || "";
  return error.code === "42P01" || error.code === "42703" || error.code === "PGRST205" || message.includes("schema cache");
}

async function academyContext(request: Request) {
  if (!isSupabaseServerConfigured || !isSupabaseAdminConfigured) {
    return { response: NextResponse.json({ error: "Supabase server não configurado." }, { status: 500 }) };
  }

  const token = bearerToken(request);
  if (!token) {
    return { response: NextResponse.json({ error: "Sessão ausente." }, { status: 401 }) };
  }

  const authClient = createSupabaseAuthServerClient(token);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return { response: NextResponse.json({ error: "Sessão inválida." }, { status: 401 }) };
  }

  return {
    adminClient: createSupabaseAdminClient(),
    user: data.user,
  };
}

async function loadProgressRow(adminClient: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const { data, error } = await adminClient
    .from("user_academy_progress")
    .select("user_id,completed_steps,current_step_id,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && !isMissingAcademyTable(error)) throw error;
  return (data || null) as AcademyProgressRow | null;
}

export async function GET(request: Request) {
  const context = await academyContext(request);
  if ("response" in context) return context.response;

  try {
    const row = await loadProgressRow(context.adminClient, context.user.id);
    const progress = buildAcademyProgress({
      completedStepIds: row?.completed_steps || [],
      currentStepId: row?.current_step_id || null,
    });

    return NextResponse.json({ ok: true, progress, updatedAt: row?.updated_at || null });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar seu progresso da Academy." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await academyContext(request);
  if ("response" in context) return context.response;

  const body = await request.json().catch(() => ({}));
  const stepId = typeof body.stepId === "string" ? body.stepId : "";
  const knownStep = getAcademySteps().find((step) => step.id === stepId);
  if (!knownStep) {
    return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
  }

  try {
    const row = await loadProgressRow(context.adminClient, context.user.id);
    const completedSteps = row?.completed_steps || [];
    if (!isAcademyStepUnlocked(stepId, completedSteps)) {
      return NextResponse.json({ error: "Conclua as etapas anteriores antes de avançar." }, { status: 409 });
    }

    const nextCompleted = completeAcademyStep(completedSteps, stepId);
    const summary = buildAcademyProgress({ completedStepIds: nextCompleted });
    const { data, error } = await context.adminClient
      .from("user_academy_progress")
      .upsert({
        user_id: context.user.id,
        completed_steps: nextCompleted,
        current_step_id: summary.currentStep?.id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select("user_id,completed_steps,current_step_id,updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      progress: buildAcademyProgress({
        completedStepIds: (data as AcademyProgressRow).completed_steps || [],
        currentStepId: (data as AcademyProgressRow).current_step_id || null,
      }),
      updatedAt: (data as AcademyProgressRow).updated_at || null,
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar seu progresso da Academy." }, { status: 500 });
  }
}

export const PATCH = POST;

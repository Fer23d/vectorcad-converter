import { NextResponse } from "next/server";
import { normalizeCompany, planHasPremiumAccess } from "@/lib/access-control";
import { requireAdmin } from "@/lib/admin-auth";
import { getUserEffectivePlan } from "@/lib/effective-plan";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

async function logAdminAction(adminClient: ReturnType<typeof createSupabaseAdminClient>, adminId: string, action: string, targetType: string, targetId: string, metadata: Record<string, unknown> = {}) {
  const { error } = await adminClient.from("admin_logs").insert([{ admin_id: adminId, action, target_type: targetType, target_id: targetId, metadata }]);
  if (error && error.code !== "42P01") throw error;
}

function isMissingRelation(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() || "";
  return error.code === "42P01" || error.code === "42703" || error.code === "PGRST205" || message.includes("schema cache") || message.includes("company_id");
}

async function upsertProfileCompany(adminClient: ReturnType<typeof createSupabaseAdminClient>, payload: Record<string, unknown>) {
  const { error } = await adminClient.from("profiles").upsert(payload, { onConflict: "user_id" });
  if (!error) return null;
  if (!isMissingRelation(error)) return error;

  const fallbackPayload: Record<string, unknown> = { ...payload };
  delete fallbackPayload.company_id;
  const { error: fallbackError } = await adminClient.from("profiles").upsert(fallbackPayload, { onConflict: "user_id" });
  return fallbackError;
}

async function upsertPublicUserCompany(adminClient: ReturnType<typeof createSupabaseAdminClient>, payload: Record<string, unknown>) {
  const { error } = await adminClient.from("users").upsert(payload, { onConflict: "id" });
  if (!error) return null;
  if (!isMissingRelation(error)) return error;

  const fallbackPayload: Record<string, unknown> = { ...payload };
  delete fallbackPayload.company_id;
  const { error: fallbackError } = await adminClient.from("users").upsert(fallbackPayload, { onConflict: "id" });
  return fallbackError && !isMissingRelation(fallbackError) ? fallbackError : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminAuth = await requireAdmin(request);
  if ("response" in adminAuth) return adminAuth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const requestedCompany = normalizeCompany(typeof body.company === "string" ? body.company : null);
  const { adminClient, user: adminUser } = adminAuth;

  const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(id);
  if (userError || !userData.user) {
    return NextResponse.json({ error: userError?.message || "Usuário não encontrado." }, { status: 404 });
  }

  const existingMetadata = userData.user.user_metadata || {};
  const now = new Date().toISOString();
  let company = requestedCompany;
  let companyId: string | null = null;

  if (company) {
    const { data: existingCompany, error: companyLookupError } = await adminClient
      .from("companies")
      .select("id,name,plan")
      .eq("name", company)
      .maybeSingle();

    if (companyLookupError && !isMissingRelation(companyLookupError)) {
      return NextResponse.json({ error: companyLookupError.message }, { status: 500 });
    }

    if (existingCompany?.id) {
      companyId = existingCompany.id;
      company = existingCompany.name;
    } else {
      const { data: createdCompany, error: createCompanyError } = await adminClient
        .from("companies")
        .upsert({ name: company, plan: company.toLowerCase() === "sm&a" ? "empresarial" : "free", updated_at: now }, { onConflict: "name" })
        .select("id,name,plan")
        .single();

      if (createCompanyError && !isMissingRelation(createCompanyError)) {
        return NextResponse.json({ error: createCompanyError.message }, { status: 500 });
      }

      companyId = createdCompany?.id || null;
      company = createdCompany?.name || company;
    }
  }

  if (company) {
    const { error: membershipError } = await adminClient.from("companies_users").upsert({
      user_id: id,
      company_id: companyId,
      company_name: company,
      plan_grant: "pro",
      assigned_by: adminUser.id,
      updated_at: now,
    }, { onConflict: "user_id,company_name" });

    if (membershipError && !isMissingRelation(membershipError)) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }
  } else {
    const { error: membershipError } = await adminClient
      .from("companies_users")
      .delete()
      .eq("user_id", id);

    if (membershipError && !isMissingRelation(membershipError)) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }
  }

  const { error: metadataError } = await adminClient.auth.admin.updateUserById(id, {
    user_metadata: { ...existingMetadata, company, company_id: companyId },
  });

  if (metadataError) {
    return NextResponse.json({ error: metadataError.message }, { status: 500 });
  }

  const profileError = await upsertProfileCompany(adminClient, {
    user_id: id,
    name: existingMetadata.first_name || null,
    surname: existingMetadata.last_name || null,
    company,
    company_id: companyId,
    updated_at: now,
  });

  if (profileError && profileError.code !== "42P01") {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const publicUserError = await upsertPublicUserCompany(adminClient, {
    id,
    email: userData.user.email || null,
    company,
    company_id: companyId,
    updated_at: now,
  });

  if (publicUserError) {
    return NextResponse.json({ error: publicUserError.message }, { status: 500 });
  }

  const effectivePlan = await getUserEffectivePlan(adminClient, id, { user: userData.user });
  console.log("[admin/users/company] company assignment", {
    email: userData.user.email,
    company,
    company_id: companyId,
    applied_plan: effectivePlan.plan,
    source: effectivePlan.source,
  });

  await logAdminAction(
    adminClient,
    adminUser.id,
    company ? "user.company_add" : "user.company_remove",
    "user",
    id,
    { email: userData.user.email, company, company_id: companyId, applied_plan: effectivePlan.plan, plan_source: effectivePlan.source },
  );

  return NextResponse.json({
    id,
    company,
    company_id: companyId,
    plan: effectivePlan.plan,
    premium: planHasPremiumAccess(effectivePlan.plan),
    planSource: effectivePlan.source,
  });
}

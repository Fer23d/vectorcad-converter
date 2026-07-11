import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { isPremiumCompany, normalizeCompany, normalizeCompanyPlan, planHasPremiumAccess, resolveUserPlan } from "@/lib/access-control";
import { createSupabaseAdminClient, createSupabaseAuthServerClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

function isMissingRelation(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() || "";
  return error.code === "42P01" || error.code === "PGRST205" || message.includes("schema cache");
}

export async function GET(request: Request) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Sessão ausente." }, { status: 401 });
  }

  const authClient = createSupabaseAuthServerClient(token);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  if (!isAdminUser(userData.user.id)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Configure SUPABASE_SERVICE_ROLE_KEY para ativar o painel admin." }, { status: 500 });
  }

  const requestedCompany = normalizeCompany(new URL(request.url).searchParams.get("company"));
  const adminClient = createSupabaseAdminClient();
  const [{ data: usersData, error: usersError }, { data: projectsData, error: projectsError }, { data: appUsersData, error: appUsersError }, { data: membershipsData, error: membershipsError }, { data: logsData, error: logsError }] = await Promise.all([
    adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    adminClient.from("projects").select("id,name,user_id,type,created_at,updated_at").order("created_at", { ascending: false }),
    adminClient.from("users").select("id,email,company,plan,is_premium"),
    adminClient.from("companies_users").select("user_id,company_id,company_name,plan_grant"),
    adminClient.from("admin_logs").select("id,admin_id,action,target_type,target_id,metadata,created_at").order("created_at", { ascending: false }).limit(40),
  ]);

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  if (projectsError) {
    return NextResponse.json({ error: projectsError.message }, { status: 500 });
  }

  const appUsersById = new Map((appUsersError ? [] : appUsersData || []).map((appUser) => [appUser.id, appUser]));
  const membershipsByUserId = new Map((membershipsError && !isMissingRelation(membershipsError) ? [] : membershipsData || []).map((membership) => [membership.user_id, membership]));
  const resolveCompany = (value?: string | null) => {
    const normalized = normalizeCompany(value);
    return isPremiumCompany(normalized)
      ? { id: "SM&A", name: "SM&A", plan: normalizeCompanyPlan("pro") }
      : { id: null as string | null, name: null as string | null, plan: normalizeCompanyPlan("free") };
  };
  const selectedCompany = requestedCompany ? resolveCompany(requestedCompany) : null;
  const users = usersData.users.map((user) => {
    const appUser = appUsersById.get(user.id);
    const membership = membershipsByUserId.get(user.id);
    const companyInfo = resolveCompany(membership?.company_name || "");
    const individualPlan = normalizeCompanyPlan(appUser?.plan || String(user.user_metadata?.plan || ""));
    const individualPremium = Boolean(appUser?.is_premium || user.user_metadata?.is_premium);
    const membershipPlan = normalizeCompanyPlan(membership?.plan_grant || null);
    const effectivePlan = companyInfo.name ? membershipPlan : resolveUserPlan({ plan: individualPlan, is_premium: individualPremium });
    const premium = planHasPremiumAccess(effectivePlan);

    return {
      id: user.id,
      email: user.email || appUser?.email || "sem email",
      company: companyInfo.name,
      company_id: companyInfo.id,
      companyPlan: companyInfo.plan,
      userPlan: individualPlan,
      plan: effectivePlan,
      is_premium: premium,
      premium,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at || null,
    };
  });
  const userCompanyById = new Map(users.map((user) => [user.id, user.company]));
  const projects = (projectsData || []).map((project) => ({
    ...project,
    company: userCompanyById.get(project.user_id) || null,
  }));
  const usersWithLogin = users.filter((user) => Boolean(user.last_sign_in_at));
  const companyCounts = users.reduce<Record<string, { total: number; premium: number; enterprise: number; pro: number; plus: number; free: number }>>((totals, user) => {
    const company = user.company || "Sem empresa";
    totals[company] ||= { total: 0, premium: 0, enterprise: 0, pro: 0, plus: 0, free: 0 };
    totals[company].total += 1;
    if (user.premium) totals[company].premium += 1;
    if (user.plan === "empresarial") totals[company].enterprise += 1;
    else if (user.plan === "pro") totals[company].pro += 1;
    else if (user.plan === "plus") totals[company].plus += 1;
    else totals[company].free += 1;
    return totals;
  }, {});
  const smaCounts = companyCounts["SM&A"] || { total: 0, premium: 0, enterprise: 0, pro: 0, plus: 0, free: 0 };
  const companies = [{
    id: "SM&A",
    name: "SM&A",
    plan: normalizeCompanyPlan("pro"),
    user_count: smaCounts.total,
    premium_users: smaCounts.premium,
    enterprise_users: smaCounts.enterprise,
    pro_users: smaCounts.pro,
    plus_users: smaCounts.plus,
    free_users: smaCounts.free,
    created_at: null,
    updated_at: null,
  }];
  const smAUsers = users.filter((user) => isPremiumCompany(user.company));
  const usersWithoutCompany = users.filter((user) => !user.company);
  const latestLogins = [...usersWithLogin]
    .sort((a, b) => new Date(b.last_sign_in_at || 0).getTime() - new Date(a.last_sign_in_at || 0).getTime())
    .slice(0, 5);
  const matchesSelectedCompany = (company?: string | null) => {
    if (!selectedCompany) return true;
    if (!selectedCompany.name) return !company;
    const resolved = resolveCompany(company);
    return resolved.name === selectedCompany.name || resolved.id === selectedCompany.id || company === requestedCompany;
  };
  const filteredUsers = users.filter((user) => matchesSelectedCompany(user.company));
  const filteredProjects = projects.filter((project) => matchesSelectedCompany(project.company));

  return NextResponse.json({
    stats: {
      totalUsers: users.length,
      totalProjects: projects.length,
      activeUsers: usersWithLogin.length,
      smaUsers: smAUsers.length,
    },
    companyCounts,
    companies,
    adminLogs: logsError ? [] : logsData || [],
    smAUsers,
    usersWithoutCompany,
    latestLogins,
    users,
    projects,
    filteredUsers,
    filteredProjects,
    activeCompanyFilter: requestedCompany || "all",
  });
}

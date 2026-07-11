import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { normalizeCompany, normalizeCompanyPlan, planHasPremiumAccess } from "@/lib/access-control";
import { getUserEffectivePlan } from "@/lib/effective-plan";
import { createSupabaseAdminClient, createSupabaseAuthServerClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

function isMissingRelation(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() || "";
  return error.code === "42P01" || error.code === "42703" || error.code === "PGRST205" || message.includes("schema cache");
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
  const [
    { data: usersData, error: usersError },
    { data: projectsData, error: projectsError },
    { data: appUsersData, error: appUsersError },
    { data: companiesData, error: companiesError },
    { data: logsData, error: logsError },
  ] = await Promise.all([
    adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    adminClient.from("projects").select("id,name,user_id,type,created_at,updated_at").order("created_at", { ascending: false }),
    adminClient.from("users").select("id,email,company,company_id,plan,is_premium"),
    adminClient.from("companies").select("id,name,plan,created_at,updated_at").order("name", { ascending: true }),
    adminClient.from("admin_logs").select("id,admin_id,action,target_type,target_id,metadata,created_at").order("created_at", { ascending: false }).limit(40),
  ]);

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  if (projectsError) {
    return NextResponse.json({ error: projectsError.message }, { status: 500 });
  }

  if (companiesError && !isMissingRelation(companiesError)) {
    return NextResponse.json({ error: companiesError.message }, { status: 500 });
  }

  const appUsersById = new Map((appUsersError ? [] : appUsersData || []).map((appUser) => [appUser.id, appUser]));
  const companyRecords = companiesError ? [] : companiesData || [];
  const companyById = new Map(companyRecords.map((company) => [company.id, company]));
  const companyByName = new Map(companyRecords.map((company) => [company.name, company]));

  const users = await Promise.all(usersData.users.map(async (user) => {
    const appUser = appUsersById.get(user.id);
    const effective = await getUserEffectivePlan(adminClient, user.id, {
      user,
      profile: {
        company: appUser?.company || String(user.user_metadata?.company || "") || null,
        company_id: appUser?.company_id || String(user.user_metadata?.company_id || "") || null,
        plan: appUser?.plan || String(user.user_metadata?.plan || "free"),
        is_premium: Boolean(appUser?.is_premium || user.user_metadata?.is_premium),
      },
    });

    const companyRecord = effective.companyId ? companyById.get(effective.companyId) : effective.company ? companyByName.get(effective.company) : null;
    const companyPlan = normalizeCompanyPlan(companyRecord?.plan || effective.companyPlan || null);
    const premium = planHasPremiumAccess(effective.plan);

    return {
      id: user.id,
      email: user.email || appUser?.email || "sem e-mail",
      company: effective.company,
      company_id: effective.companyId,
      companyPlan,
      userPlan: effective.individualPlan,
      plan: effective.plan,
      planSource: effective.source,
      is_premium: premium,
      premium,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at || null,
    };
  }));

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

  const companies = companyRecords.map((company) => {
    const counts = companyCounts[company.name] || { total: 0, premium: 0, enterprise: 0, pro: 0, plus: 0, free: 0 };
    return {
      id: company.id,
      name: company.name,
      plan: normalizeCompanyPlan(company.plan),
      user_count: counts.total,
      premium_users: counts.premium,
      enterprise_users: counts.enterprise,
      pro_users: counts.pro,
      plus_users: counts.plus,
      free_users: counts.free,
      created_at: company.created_at || null,
      updated_at: company.updated_at || null,
    };
  });

  if (!companies.some((company) => company.name === "SM&A")) {
    const counts = companyCounts["SM&A"] || { total: 0, premium: 0, enterprise: 0, pro: 0, plus: 0, free: 0 };
    companies.unshift({
      id: "SM&A",
      name: "SM&A",
      plan: normalizeCompanyPlan("empresarial"),
      user_count: counts.total,
      premium_users: counts.premium,
      enterprise_users: counts.enterprise,
      pro_users: counts.pro,
      plus_users: counts.plus,
      free_users: counts.free,
      created_at: null,
      updated_at: null,
    });
  }

  const smAUsers = users.filter((user) => user.company === "SM&A");
  const usersWithoutCompany = users.filter((user) => !user.company);
  const latestLogins = [...usersWithLogin]
    .sort((a, b) => new Date(b.last_sign_in_at || 0).getTime() - new Date(a.last_sign_in_at || 0).getTime())
    .slice(0, 5);
  const matchesSelectedCompany = (company?: string | null) => {
    if (!requestedCompany || requestedCompany === "all") return true;
    if (requestedCompany === "Sem empresa") return !company;
    return company === requestedCompany;
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

import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { isPremiumCompany, normalizeCompany, normalizeCompanyPlan, planHasPremiumAccess } from "@/lib/access-control";
import { createSupabaseAdminClient, createSupabaseAuthServerClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

export async function GET(request: Request) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: "Supabase nao configurado." }, { status: 500 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Sessao ausente." }, { status: 401 });
  }

  const authClient = createSupabaseAuthServerClient(token);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }

  if (!isAdminUser(userData.user.id)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Configure SUPABASE_SERVICE_ROLE_KEY para ativar o painel admin." }, { status: 500 });
  }

  const requestedCompany = normalizeCompany(new URL(request.url).searchParams.get("company"));
  const adminClient = createSupabaseAdminClient();
  const [{ data: usersData, error: usersError }, { data: projectsData, error: projectsError }, { data: profilesData, error: profilesError }, { data: appUsersData, error: appUsersError }, { data: companiesData, error: companiesError }, { data: logsData, error: logsError }] = await Promise.all([
    adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    adminClient.from("projects").select("id,name,user_id,type,created_at,updated_at").order("created_at", { ascending: false }),
    adminClient.from("profiles").select("user_id,name,surname,company"),
    adminClient.from("users").select("id,email,company,plan,is_premium"),
    adminClient.from("companies").select("id,name,plan,created_at,updated_at").order("created_at", { ascending: false }),
    adminClient.from("admin_logs").select("id,admin_id,action,target_type,target_id,metadata,created_at").order("created_at", { ascending: false }).limit(40),
  ]);

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  if (projectsError) {
    return NextResponse.json({ error: projectsError.message }, { status: 500 });
  }

  const rawCompanies = companiesError ? [] : companiesData || [];
  const profilesByUserId = new Map((profilesError ? [] : profilesData || []).map((profile) => [profile.user_id, profile]));
  const appUsersById = new Map((appUsersError ? [] : appUsersData || []).map((appUser) => [appUser.id, appUser]));
  const companyById = new Map(rawCompanies.map((company) => [company.id, company]));
  const companyByName = new Map(rawCompanies.map((company) => [company.name, company]));
  const resolveCompany = (value?: string | null) => {
    const normalized = normalizeCompany(value);
    if (!normalized) {
      return { id: null as string | null, name: null as string | null, plan: normalizeCompanyPlan("free") };
    }

    const company = companyById.get(normalized) || companyByName.get(normalized);
    if (company) {
      return { id: company.id, name: company.name, plan: normalizeCompanyPlan(company.plan) };
    }

    return {
      id: null as string | null,
      name: normalized,
      plan: normalizeCompanyPlan(isPremiumCompany(normalized) ? "empresarial" : "free"),
    };
  };
  const selectedCompany = requestedCompany ? resolveCompany(requestedCompany) : null;
  const users = usersData.users.map((user) => {
    const profile = profilesByUserId.get(user.id);
    const appUser = appUsersById.get(user.id);
    const companyInfo = resolveCompany(profile?.company || appUser?.company || String(user.user_metadata?.company || ""));
    const individualPlan = normalizeCompanyPlan(appUser?.plan || String(user.user_metadata?.plan || ""));
    const individualPremium = Boolean(appUser?.is_premium || user.user_metadata?.is_premium);
    const companyPremium = isPremiumCompany(companyInfo.name) || normalizeCompanyPlan(companyInfo.plan) === "empresarial";
    const premium = companyPremium || individualPremium || planHasPremiumAccess(individualPlan);
    const effectivePlan = companyPremium ? normalizeCompanyPlan("empresarial") : individualPremium && individualPlan === "free" ? normalizeCompanyPlan("pro") : individualPlan;

    return {
      id: user.id,
      email: user.email || appUser?.email || "sem email",
      company: companyInfo.name,
      company_id: companyInfo.id,
      companyPlan: companyInfo.plan,
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
    company: userCompanyById.get(project.user_id) || resolveCompany(profilesByUserId.get(project.user_id)?.company).name,
  }));
  const usersWithLogin = users.filter((user) => Boolean(user.last_sign_in_at));
  const companyCounts = users.reduce<Record<string, { total: number; premium: number }>>((totals, user) => {
    const company = user.company || "Sem empresa";
    totals[company] ||= { total: 0, premium: 0 };
    totals[company].total += 1;
    if (user.premium) totals[company].premium += 1;
    return totals;
  }, {});
  const companies = companiesError
    ? Object.entries(companyCounts).filter(([name]) => name !== "Sem empresa").map(([name, counts]) => ({
      id: name,
      name,
      plan: normalizeCompanyPlan(isPremiumCompany(name) ? "empresarial" : "free"),
      user_count: counts.total,
      premium_users: counts.premium,
      created_at: null,
      updated_at: null,
    }))
    : (companiesData || []).map((company) => ({
      ...company,
      plan: normalizeCompanyPlan(company.plan),
      user_count: companyCounts[company.name]?.total || 0,
      premium_users: companyCounts[company.name]?.premium || 0,
    }));
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

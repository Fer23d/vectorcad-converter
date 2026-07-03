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

  const adminClient = createSupabaseAdminClient();
  const [{ data: usersData, error: usersError }, { data: projectsData, error: projectsError }, { data: profilesData, error: profilesError }, { data: companiesData, error: companiesError }, { data: logsData, error: logsError }] = await Promise.all([
    adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    adminClient.from("projects").select("id,name,user_id,type,created_at,updated_at").order("created_at", { ascending: false }),
    adminClient.from("profiles").select("user_id,name,surname,company"),
    adminClient.from("companies").select("id,name,plan,created_at,updated_at").order("created_at", { ascending: false }),
    adminClient.from("admin_logs").select("id,admin_id,action,target_type,target_id,metadata,created_at").order("created_at", { ascending: false }).limit(40),
  ]);

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  if (projectsError) {
    return NextResponse.json({ error: projectsError.message }, { status: 500 });
  }

  const profilesByUserId = new Map((profilesError ? [] : profilesData || []).map((profile) => [profile.user_id, profile]));
  const companyPlanByName = new Map((companiesError ? [] : companiesData || []).map((company) => [company.name, normalizeCompanyPlan(company.plan)]));
  const users = usersData.users.map((user) => {
    const company = normalizeCompany(profilesByUserId.get(user.id)?.company || String(user.user_metadata?.company || ""));
    const companyPlan = company ? companyPlanByName.get(company) || (isPremiumCompany(company) ? "enterprise" : "free") : "free";
    const premium = isPremiumCompany(company) || planHasPremiumAccess(companyPlan);

    return {
    id: user.id,
    email: user.email || "sem email",
    company,
    companyPlan,
    premium,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at || null,
    };
  });
  const userCompanyById = new Map(users.map((user) => [user.id, user.company]));
  const projects = (projectsData || []).map((project) => ({
    ...project,
    company: profilesByUserId.get(project.user_id)?.company || userCompanyById.get(project.user_id) || null,
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
      plan: normalizeCompanyPlan(isPremiumCompany(name) ? "enterprise" : "free"),
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
  });
}

import { NextResponse } from "next/server";
import { normalizeCompany, normalizeCompanyPlan, planHasPremiumAccess } from "@/lib/access-control";
import { requireAdmin } from "@/lib/admin-auth";
import { getUserEffectivePlan } from "@/lib/effective-plan";

function isMissingRelation(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() || "";
  return error.code === "42P01" || error.code === "42703" || error.code === "PGRST205" || message.includes("schema cache");
}

export async function GET(request: Request) {
  const adminAuth = await requireAdmin(request);
  if ("response" in adminAuth) return adminAuth.response;

  const requestedCompany = normalizeCompany(new URL(request.url).searchParams.get("company"));
  const { adminClient, role, user: adminUser } = adminAuth;
  const adminFirstName = String(adminUser.user_metadata?.first_name || "").trim();
  const adminLastName = String(adminUser.user_metadata?.last_name || "").trim();
  const adminName = [adminFirstName, adminLastName].filter(Boolean).join(" ") || "Administrador vetorcad";
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

  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 });
  if (projectsError) return NextResponse.json({ error: projectsError.message }, { status: 500 });
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
      role: String(user.app_metadata?.role || user.user_metadata?.role || "USER"),
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
    role,
    adminUser: {
      id: adminUser.id,
      email: adminUser.email,
      name: adminName,
      role,
    },
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

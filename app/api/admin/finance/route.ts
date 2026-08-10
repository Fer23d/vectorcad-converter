import { NextResponse } from "next/server";
import { normalizeCompanyPlan, type CompanyPlan } from "@/lib/access-control";
import { getBillingPlan } from "@/lib/billing";
import { requireAdmin } from "@/lib/admin-auth";
import { buildAdminPlanIndex, isActiveSubscription, listAllAuthUsers, type AdminBillingUserRow, type AdminCompanyRow, type AdminMembershipRow, type AdminProfileRow, type AdminSubscriptionRow } from "@/lib/admin-plan-resolution";

type PlanUsage = { plan: CompanyPlan; users: number; subscriptions: number; revenue: number; estimatedRevenue: number; projects: number; dailyUsage: number; daily3d: number };
const planIds: CompanyPlan[] = ["free", "plus", "pro", "empresarial"];

function monthKey(date: string) {
  const value = new Date(date);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1))).replace(".", "");
}

export async function GET(request: Request) {
  const adminAuth = await requireAdmin(request);
  if ("response" in adminAuth) return adminAuth.response;
  const { adminClient } = adminAuth;

  try {
    const [authUsers, usersResult, profilesResult, membershipsResult, companiesResult, subscriptionsResult, projectsResult] = await Promise.all([
      listAllAuthUsers(adminClient),
      adminClient.from("users").select("id,plan,company,company_id,usage_count_today,export3d_count_today"),
      adminClient.from("profiles").select("user_id,plan,is_premium,company,company_id,usage_count_today,export3d_count_today"),
      adminClient.from("companies_users").select("user_id,company_id,company_name,plan_grant"),
      adminClient.from("companies").select("id,name,plan"),
      adminClient.from("subscriptions").select("user_id,plan,status,amount,created_at,updated_at"),
      adminClient.from("projects").select("user_id,created_at"),
    ]);
    const firstError = [usersResult.error, profilesResult.error, membershipsResult.error, companiesResult.error, subscriptionsResult.error, projectsResult.error].find(Boolean);
    if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

    const users = (usersResult.data || []) as AdminBillingUserRow[];
    const profiles = (profilesResult.data || []) as AdminProfileRow[];
    const memberships = (membershipsResult.data || []) as AdminMembershipRow[];
    const companies = (companiesResult.data || []) as AdminCompanyRow[];
    const subscriptions = (subscriptionsResult.data || []) as AdminSubscriptionRow[];
    const projects = projectsResult.data || [];
    const { resolutions, integrity } = buildAdminPlanIndex({ authUsers, profiles, billingUsers: users, memberships, companies, subscriptions });
    const projectsByUser = new Map<string, number>();
    for (const project of projects) projectsByUser.set(project.user_id, (projectsByUser.get(project.user_id) || 0) + 1);
    const planSummaries = new Map<CompanyPlan, PlanUsage>(planIds.map((plan) => [plan, { plan, users: 0, subscriptions: 0, revenue: 0, estimatedRevenue: 0, projects: 0, dailyUsage: 0, daily3d: 0 }]));

    for (const user of authUsers) {
      const resolution = resolutions.get(user.id)!;
      const billingUser = users.find((row) => row.id === user.id);
      const profile = profiles.find((row) => row.user_id === user.id);
      const summary = planSummaries.get(resolution.plan) || planSummaries.get("free")!;
      summary.users += 1;
      summary.projects += projectsByUser.get(user.id) || 0;
      summary.dailyUsage += Number(billingUser?.usage_count_today || profile?.usage_count_today || 0);
      summary.daily3d += Number(billingUser?.export3d_count_today || profile?.export3d_count_today || 0);
    }

    const latestSubscriptions = new Map<string, AdminSubscriptionRow>();
    for (const subscription of subscriptions) {
      const current = latestSubscriptions.get(subscription.user_id);
      if (!current || new Date(subscription.updated_at || subscription.created_at || 0) >= new Date(current.updated_at || current.created_at || 0)) latestSubscriptions.set(subscription.user_id, subscription);
    }
    let mrr = 0;
    let estimatedRevenue = 0;
    let activeSubscriptions = 0;
    for (const [userId, subscription] of latestSubscriptions) {
      const resolution = resolutions.get(userId);
      if (!resolution?.billableSubscription || !isActiveSubscription(subscription.status)) continue;
      const plan = normalizeCompanyPlan(subscription.plan);
      const summary = planSummaries.get(plan) || planSummaries.get("free")!;
      const amount = Number(subscription.amount || 0);
      summary.subscriptions += 1;
      summary.revenue += amount;
      summary.estimatedRevenue += getBillingPlan(plan).price;
      mrr += amount;
      estimatedRevenue += getBillingPlan(plan).price;
      activeSubscriptions += 1;
    }

    const now = new Date();
    const growth = Array.from({ length: 12 }, (_, index) => { const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1)); const key = monthKey(date.toISOString()); return { key, label: monthLabel(key), users: 0, projects: 0, subscriptions: 0 }; });
    const growthByKey = new Map(growth.map((item) => [item.key, item]));
    for (const user of authUsers) { const month = growthByKey.get(monthKey(user.created_at)); if (month) month.users += 1; }
    for (const project of projects) { const month = growthByKey.get(monthKey(project.created_at || "")); if (month) month.projects += 1; }
    for (const subscription of subscriptions) { const month = growthByKey.get(monthKey(subscription.created_at || "")); if (month) month.subscriptions += 1; }
    const revenueSeries = growth.map((item) => ({ ...item, revenue: subscriptions.filter((subscription) => monthKey(subscription.created_at || "") === item.key).reduce((total, subscription) => total + Number(subscription.amount || 0), 0) }));
    const currentMonth = revenueSeries[revenueSeries.length - 1]?.revenue || 0;
    const previousMonth = revenueSeries[revenueSeries.length - 2]?.revenue || 0;
    const newRevenueGrowth = previousMonth > 0 ? Math.round(((currentMonth - previousMonth) / previousMonth) * 100) : null;
    const projectUserIds = new Set(projects.map((project) => project.user_id));
    const recentUsers = [...authUsers].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8).map((user) => ({ id: user.id, email: user.email || "sem e-mail", created_at: user.created_at, last_sign_in_at: user.last_sign_in_at || null, plan: resolutions.get(user.id)?.plan || "free", planSource: resolutions.get(user.id)?.source || "DEFAULT" }));
    const recentActivity = [
      ...authUsers.map((user) => ({ id: `user-${user.id}`, kind: "USER_CREATED", label: "Novo usuário", detail: user.email || "Usuário sem e-mail", createdAt: user.created_at })),
      ...subscriptions.map((subscription) => ({ id: `subscription-${subscription.user_id}-${subscription.created_at}`, kind: ["cancelled", "canceled"].includes(String(subscription.status || "").toLowerCase()) ? "SUBSCRIPTION_CANCELLED" : "SUBSCRIPTION_CREATED", label: ["cancelled", "canceled"].includes(String(subscription.status || "").toLowerCase()) ? "Assinatura cancelada" : "Assinatura criada", detail: normalizeCompanyPlan(subscription.plan), createdAt: subscription.updated_at || subscription.created_at || "" })),
      ...projects.map((project) => ({ id: `project-${project.user_id}-${project.created_at}`, kind: "PROJECT_CREATED", label: "Projeto criado", detail: "Projeto CAD", createdAt: project.created_at || "" })),
    ].filter((event) => Boolean(event.createdAt)).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 12);

    return NextResponse.json({
      metrics: { totalUsers: authUsers.length, activeSubscriptions, mrr, estimatedRevenue, cancellations: [...latestSubscriptions.values()].filter((subscription) => ["cancelled", "canceled"].includes(String(subscription.status || "").toLowerCase())).length, currency: "BRL" },
      plans: planIds.map((plan) => planSummaries.get(plan)),
      growth,
      revenueSeries,
      recentUsers,
      recentActivity,
      funnel: { registered: authUsers.length, active: authUsers.filter((user) => Boolean(user.last_sign_in_at)).length, createdProject: projectUserIds.size, usedAi: null, subscribed: activeSubscriptions },
      newRevenueGrowth,
      averageTicket: activeSubscriptions ? mrr / activeSubscriptions : 0,
      integrity,
      availability: { subscriptions: true, usage: Boolean(users.length || profiles.length), projects: true, paymentHistory: false, aiUsage: false, churn: false, planGrowth: false },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível consolidar os dados administrativos." }, { status: 500 });
  }
}

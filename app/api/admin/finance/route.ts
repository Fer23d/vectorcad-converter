import { NextResponse } from "next/server";
import { normalizeCompanyPlan, type CompanyPlan } from "@/lib/access-control";
import { getBillingPlan } from "@/lib/billing";
import { requireAdmin } from "@/lib/admin-auth";

type BillingRow = { user_id: string; plan?: string | null; status?: string | null; amount?: number | string | null; created_at?: string | null; updated_at?: string | null };
type PlanUsage = { plan: CompanyPlan; users: number; subscriptions: number; revenue: number; estimatedRevenue: number; projects: number; dailyUsage: number; daily3d: number };
const planIds: CompanyPlan[] = ["free", "plus", "pro", "empresarial"];

function isMissingRelation(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() || "";
  return error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST205" || message.includes("schema cache") || message.includes("does not exist");
}

function isActiveStatus(status?: string | null) {
  return ["active", "approved", "authorized", "paid"].includes(String(status || "").toLowerCase());
}

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
  const [authResult, subscriptionsResult, usersResult, profilesResult, projectsResult] = await Promise.all([
    adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    adminClient.from("subscriptions").select("user_id,plan,status,amount,created_at,updated_at"),
    adminClient.from("users").select("id,plan,usage_count_today,export3d_count_today"),
    adminClient.from("profiles").select("user_id,plan,usage_count_today,export3d_count_today"),
    adminClient.from("projects").select("user_id,created_at"),
  ]);
  if (authResult.error) return NextResponse.json({ error: authResult.error.message }, { status: 500 });
  if (subscriptionsResult.error && !isMissingRelation(subscriptionsResult.error)) return NextResponse.json({ error: subscriptionsResult.error.message }, { status: 500 });
  if (projectsResult.error && !isMissingRelation(projectsResult.error)) return NextResponse.json({ error: projectsResult.error.message }, { status: 500 });

  const authUsers = authResult.data.users || [];
  const subscriptions = (subscriptionsResult.error ? [] : subscriptionsResult.data || []) as BillingRow[];
  const users = usersResult.error ? [] : usersResult.data || [];
  const profiles = profilesResult.error ? [] : profilesResult.data || [];
  const projects = projectsResult.error ? [] : projectsResult.data || [];
  const usersById = new Map(users.map((row) => [row.id, row]));
  const profilesById = new Map(profiles.map((row) => [row.user_id, row]));
  const projectsByUser = new Map<string, number>();
  for (const project of projects) projectsByUser.set(project.user_id, (projectsByUser.get(project.user_id) || 0) + 1);
  const latestSubscriptionByUser = new Map<string, BillingRow>();
  for (const subscription of subscriptions) {
    const current = latestSubscriptionByUser.get(subscription.user_id);
    const currentTime = current ? new Date(current.updated_at || current.created_at || 0).getTime() : -1;
    const nextTime = new Date(subscription.updated_at || subscription.created_at || 0).getTime();
    if (!current || nextTime >= currentTime) latestSubscriptionByUser.set(subscription.user_id, subscription);
  }
  const activeSubscriptions = [...latestSubscriptionByUser.values()].filter((subscription) => isActiveStatus(subscription.status));
  const cancelledSubscriptions = subscriptions.filter((subscription) => ["cancelled", "canceled"].includes(String(subscription.status || "").toLowerCase())).length;
  const plans = new Map<CompanyPlan, PlanUsage>(planIds.map((plan) => [plan, { plan, users: 0, subscriptions: 0, revenue: 0, estimatedRevenue: 0, projects: 0, dailyUsage: 0, daily3d: 0 }]));
  for (const user of authUsers) {
    const subscription = latestSubscriptionByUser.get(user.id);
    const billingUser = usersById.get(user.id);
    const profile = profilesById.get(user.id);
    const plan = normalizeCompanyPlan(subscription?.plan || billingUser?.plan || profile?.plan || "free");
    const summary = plans.get(plan) || plans.get("free")!;
    summary.users += 1;
    summary.projects += projectsByUser.get(user.id) || 0;
    summary.dailyUsage += Number(billingUser?.usage_count_today || profile?.usage_count_today || 0);
    summary.daily3d += Number(billingUser?.export3d_count_today || profile?.export3d_count_today || 0);
  }
  let mrr = 0;
  let estimatedRevenue = 0;
  for (const subscription of activeSubscriptions) {
    const plan = normalizeCompanyPlan(subscription.plan);
    const summary = plans.get(plan) || plans.get("free")!;
    const amount = Number(subscription.amount || 0);
    summary.subscriptions += 1;
    summary.revenue += amount;
    summary.estimatedRevenue += getBillingPlan(plan).price;
    mrr += amount;
    estimatedRevenue += getBillingPlan(plan).price;
  }
  const now = new Date();
  const growth = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1));
    const key = monthKey(date.toISOString());
    return { key, label: monthLabel(key), users: 0 };
  });
  const growthByKey = new Map(growth.map((item) => [item.key, item]));
  for (const user of authUsers) {
    const month = growthByKey.get(monthKey(user.created_at));
    if (month) month.users += 1;
  }
  return NextResponse.json({
    metrics: { totalUsers: authUsers.length, activeSubscriptions: activeSubscriptions.length, mrr, estimatedRevenue, cancellations: cancelledSubscriptions, currency: "BRL" },
    plans: planIds.map((plan) => plans.get(plan)),
    growth,
    availability: { subscriptions: !subscriptionsResult.error, usage: Boolean(users.length || profiles.length), projects: !projectsResult.error, paymentHistory: false },
  });
}

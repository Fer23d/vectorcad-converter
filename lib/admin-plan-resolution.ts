import type { SupabaseClient, User } from "@supabase/supabase-js";
import { normalizeCompanyPlan, type CompanyPlan } from "@/lib/access-control";

export type AdminPlanSource = "COMPANY" | "SUBSCRIPTION" | "PROFILE" | "DEFAULT";
export type AdminProfileRow = { user_id: string; plan?: string | null; is_premium?: boolean | null; company?: string | null; company_id?: string | null; usage_count_today?: number | null; export3d_count_today?: number | null };
export type AdminBillingUserRow = { id: string; plan?: string | null; company?: string | null; company_id?: string | null; usage_count_today?: number | null; export3d_count_today?: number | null };
export type AdminMembershipRow = { user_id: string; company_id?: string | null; company_name?: string | null; plan_grant?: string | null };
export type AdminCompanyRow = { id: string; name: string; plan?: string | null };
export type AdminSubscriptionRow = { user_id: string; plan?: string | null; status?: string | null; amount?: number | string | null; created_at?: string | null; updated_at?: string | null };

export type AdminPlanResolution = {
  plan: CompanyPlan;
  source: AdminPlanSource;
  company: string | null;
  companyId: string | null;
  companyPlan: CompanyPlan | null;
  individualPlan: CompanyPlan;
  profilePlan: CompanyPlan | null;
  subscriptionPlan: CompanyPlan | null;
  subscriptionActive: boolean;
  billableSubscription: boolean;
  subscription: AdminSubscriptionRow | null;
};

export type AdminPlanIntegrity = {
  authWithoutProfile: number;
  authWithoutPlan: number;
  authWithoutBillingUser: number;
  billingUsersWithoutAuth: number;
  profilesWithoutAuth: number;
  subscriptionsWithoutUser: number;
  planDivergences: number;
  duplicateAuthIds: number;
  duplicateBillingIds: number;
  duplicateProfileUserIds: number;
};

export function isActiveSubscription(status?: string | null) {
  return ["active", "approved", "authorized", "paid"].includes(String(status || "").trim().toLowerCase());
}

export function latestSubscriptionsByUser(rows: AdminSubscriptionRow[]) {
  const latest = new Map<string, AdminSubscriptionRow>();
  for (const row of rows) {
    const current = latest.get(row.user_id);
    const currentTime = current ? new Date(current.updated_at || current.created_at || 0).getTime() : -1;
    const nextTime = new Date(row.updated_at || row.created_at || 0).getTime();
    if (!current || nextTime >= currentTime) latest.set(row.user_id, row);
  }
  return latest;
}

export function resolveAdminPlan(input: { profile?: AdminProfileRow | null; billingUser?: AdminBillingUserRow | null; membership?: AdminMembershipRow | null; company?: AdminCompanyRow | null; subscription?: AdminSubscriptionRow | null }): AdminPlanResolution {
  const profilePlan = input.profile?.plan ? normalizeCompanyPlan(input.profile.plan) : null;
  const subscriptionActive = isActiveSubscription(input.subscription?.status);
  const subscriptionPlan = subscriptionActive && input.subscription?.plan ? normalizeCompanyPlan(input.subscription.plan) : null;
  const companyPlan = normalizeCompanyPlan(input.company?.plan || input.membership?.plan_grant || "free");
  const hasCompanyGrant = Boolean(input.membership && companyPlan !== "free");
  const company = input.company?.name || input.membership?.company_name || input.profile?.company || null;
  const companyId = input.company?.id || input.membership?.company_id || input.profile?.company_id || null;

  if (hasCompanyGrant) return { plan: companyPlan, source: "COMPANY", company, companyId, companyPlan, individualPlan: profilePlan || "free", profilePlan, subscriptionPlan, subscriptionActive, billableSubscription: false, subscription: input.subscription || null };
  if (subscriptionPlan) return { plan: subscriptionPlan, source: "SUBSCRIPTION", company, companyId, companyPlan: companyPlan === "free" ? null : companyPlan, individualPlan: profilePlan || "free", profilePlan, subscriptionPlan, subscriptionActive, billableSubscription: true, subscription: input.subscription || null };
  if (profilePlan) return { plan: profilePlan, source: "PROFILE", company, companyId, companyPlan: companyPlan === "free" ? null : companyPlan, individualPlan: profilePlan, profilePlan, subscriptionPlan: null, subscriptionActive, billableSubscription: false, subscription: input.subscription || null };
  return { plan: "free", source: "DEFAULT", company, companyId, companyPlan: companyPlan === "free" ? null : companyPlan, individualPlan: "free", profilePlan: null, subscriptionPlan: null, subscriptionActive, billableSubscription: false, subscription: input.subscription || null };
}

export async function listAllAuthUsers(adminClient: SupabaseClient) {
  const users: User[] = [];
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const result = await adminClient.auth.admin.listUsers({ page, perPage });
    if (result.error) throw result.error;
    users.push(...result.data.users);
    if (result.data.users.length < perPage) return users;
  }
}

export function buildAdminPlanIndex(input: { authUsers: User[]; profiles: AdminProfileRow[]; billingUsers: AdminBillingUserRow[]; memberships: AdminMembershipRow[]; companies: AdminCompanyRow[]; subscriptions: AdminSubscriptionRow[] }) {
  const profilesById = new Map(input.profiles.map((row) => [row.user_id, row]));
  const billingUsersById = new Map(input.billingUsers.map((row) => [row.id, row]));
  const membershipsById = new Map(input.memberships.map((row) => [row.user_id, row]));
  const companiesById = new Map(input.companies.map((row) => [row.id, row]));
  const companiesByName = new Map(input.companies.map((row) => [row.name, row]));
  const subscriptionsById = latestSubscriptionsByUser(input.subscriptions);
  const authIds = new Set(input.authUsers.map((user) => user.id));
  const resolutions = new Map<string, AdminPlanResolution>();
  let planDivergences = 0;

  for (const user of input.authUsers) {
    const profile = profilesById.get(user.id) || null;
    const billingUser = billingUsersById.get(user.id) || null;
    const membership = membershipsById.get(user.id) || (profile?.company_id ? { user_id: user.id, company_id: profile.company_id, company_name: profile.company || null, plan_grant: null } : null);
    const company = membership?.company_id ? companiesById.get(membership.company_id) || null : membership?.company_name ? companiesByName.get(membership.company_name) || null : null;
    const subscription = subscriptionsById.get(user.id) || null;
    const resolution = resolveAdminPlan({ profile, billingUser, membership, company, subscription });
    resolutions.set(user.id, resolution);
    const sources = [resolution.profilePlan, resolution.subscriptionPlan, company ? normalizeCompanyPlan(company.plan) : null].filter(Boolean);
    if (new Set(sources).size > 1) planDivergences += 1;
  }

  const duplicateCount = <T>(rows: T[], key: (row: T) => string) => Math.max(0, rows.length - new Set(rows.map(key)).size);
  return {
    resolutions,
    integrity: {
      authWithoutProfile: input.authUsers.filter((user) => !profilesById.has(user.id)).length,
      authWithoutPlan: [...resolutions.values()].filter((resolution) => resolution.source === "DEFAULT").length,
      authWithoutBillingUser: input.authUsers.filter((user) => !billingUsersById.has(user.id)).length,
      billingUsersWithoutAuth: input.billingUsers.filter((row) => !authIds.has(row.id)).length,
      profilesWithoutAuth: input.profiles.filter((row) => !authIds.has(row.user_id)).length,
      subscriptionsWithoutUser: input.subscriptions.filter((row) => !authIds.has(row.user_id)).length,
      planDivergences,
      duplicateAuthIds: duplicateCount(input.authUsers, (row) => row.id),
      duplicateBillingIds: duplicateCount(input.billingUsers, (row) => row.id),
      duplicateProfileUserIds: duplicateCount(input.profiles, (row) => row.user_id),
    } satisfies AdminPlanIntegrity,
  };
}

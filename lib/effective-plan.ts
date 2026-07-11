import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isPremiumCompany, normalizeCompany, normalizeCompanyPlan, planHasPremiumAccess, resolveUserPlan, type CompanyPlan } from "@/lib/access-control";

type CompanyMembership = {
  company_id?: string | null;
  company_name?: string | null;
  plan_grant?: string | null;
};

type CompanyRecord = {
  id?: string | null;
  name?: string | null;
  plan?: string | null;
};

type SubscriptionRecord = {
  plan?: string | null;
  status?: string | null;
};

type ProfileRecord = {
  company?: string | null;
  company_id?: string | null;
  plan?: string | null;
  is_premium?: boolean | null;
};

export type EffectivePlanResult = {
  plan: CompanyPlan;
  source: "company" | "subscription" | "profile" | "free";
  company: string | null;
  companyId: string | null;
  companyPlan: CompanyPlan | null;
  individualPlan: CompanyPlan;
  subscriptionPlan: CompanyPlan | null;
  isPremium: boolean;
};

function isMissingRelation(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() || "";
  return error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST205" || message.includes("schema cache");
}

function isActiveSubscription(status?: string | null) {
  const normalized = String(status || "").toLowerCase();
  return ["active", "approved", "authorized", "paid"].includes(normalized);
}

function companyGrantsPro(company?: CompanyRecord | null) {
  const companyPlan = normalizeCompanyPlan(company?.plan);
  return companyPlan === "empresarial" || companyPlan === "pro" || isPremiumCompany(company?.name);
}

export async function getUserEffectivePlan(
  adminClient: SupabaseClient,
  userId: string,
  options: { user?: User | null; profile?: ProfileRecord | null } = {},
): Promise<EffectivePlanResult> {
  const profile = options.profile || await loadProfile(adminClient, userId);
  const userMetadata = options.user?.user_metadata || {};
  const metadataPlan = normalizeCompanyPlan(String(userMetadata.plan || "free"));
  const profilePlan = normalizeCompanyPlan(profile?.plan || metadataPlan);
  const individualPremium = Boolean(profile?.is_premium || userMetadata.is_premium);
  const individualPlan = resolveUserPlan({ plan: profilePlan, is_premium: individualPremium });

  const membership = await loadMembership(adminClient, userId, profile);
  const company = await loadCompany(adminClient, membership, profile);
  const hasAdminCompanyLink = Boolean(membership?.company_id || membership?.company_name || profile?.company_id);
  const companyName = normalizeCompany(company?.name || membership?.company_name || (profile?.company_id ? profile?.company : null));
  const companyId = company?.id || membership?.company_id || profile?.company_id || null;
  const companyPlan = company ? normalizeCompanyPlan(company.plan) : null;

  if (hasAdminCompanyLink && (companyGrantsPro(company) || (companyName && isPremiumCompany(companyName)))) {
    return {
      plan: "pro",
      source: "company",
      company: companyName,
      companyId,
      companyPlan: companyPlan || "pro",
      individualPlan,
      subscriptionPlan: null,
      isPremium: true,
    };
  }

  const subscriptionPlan = await loadSubscriptionPlan(adminClient, userId);
  if (subscriptionPlan && subscriptionPlan !== "free") {
    return {
      plan: subscriptionPlan,
      source: "subscription",
      company: companyName,
      companyId,
      companyPlan,
      individualPlan,
      subscriptionPlan,
      isPremium: planHasPremiumAccess(subscriptionPlan),
    };
  }

  return {
    plan: individualPlan,
    source: individualPlan === "free" ? "free" : "profile",
    company: companyName,
    companyId,
    companyPlan,
    individualPlan,
    subscriptionPlan: null,
    isPremium: planHasPremiumAccess(individualPlan),
  };
}

async function loadProfile(adminClient: SupabaseClient, userId: string) {
  const { data, error } = await adminClient
    .from("profiles")
    .select("company,company_id,plan,is_premium")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && !isMissingRelation(error)) throw error;
  return (data || null) as ProfileRecord | null;
}

async function loadMembership(adminClient: SupabaseClient, userId: string, profile?: ProfileRecord | null) {
  const { data, error } = await adminClient
    .from("companies_users")
    .select("company_id,company_name,plan_grant")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error && !isMissingRelation(error)) throw error;
  if (data) return data as CompanyMembership;
  if (profile?.company_id) {
    return {
      company_id: profile.company_id,
      company_name: profile.company,
      plan_grant: null,
    };
  }
  return null;
}

async function loadCompany(adminClient: SupabaseClient, membership?: CompanyMembership | null, profile?: ProfileRecord | null) {
  const companyId = membership?.company_id || profile?.company_id;
  const companyName = membership?.company_name;

  if (companyId) {
    const { data, error } = await adminClient
      .from("companies")
      .select("id,name,plan")
      .eq("id", companyId)
      .maybeSingle();

    if (error && !isMissingRelation(error)) throw error;
    if (data) return data as CompanyRecord;
  }

  if (companyName) {
    const { data, error } = await adminClient
      .from("companies")
      .select("id,name,plan")
      .eq("name", companyName)
      .maybeSingle();

    if (error && !isMissingRelation(error)) throw error;
    if (data) return data as CompanyRecord;
  }

  return null;
}

async function loadSubscriptionPlan(adminClient: SupabaseClient, userId: string) {
  const { data, error } = await adminClient
    .from("subscriptions")
    .select("plan,status")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && !isMissingRelation(error)) throw error;
  const subscription = data as SubscriptionRecord | null;
  if (!subscription || !isActiveSubscription(subscription.status)) return null;
  return normalizeCompanyPlan(subscription.plan);
}

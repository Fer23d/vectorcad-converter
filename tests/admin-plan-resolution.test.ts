import { describe, expect, it } from "vitest";
import { buildAdminPlanIndex, resolveAdminPlan } from "@/lib/admin-plan-resolution";

describe("admin plan resolution", () => {
  it("prioritizes an active company grant over an individual subscription", () => {
    const result = resolveAdminPlan({
      membership: { user_id: "u1", company_id: "c1", company_name: "Empresa", plan_grant: "empresarial" },
      company: { id: "c1", name: "Empresa", plan: "empresarial" },
      subscription: { user_id: "u1", plan: "pro", status: "active", amount: 25.9 },
      profile: { user_id: "u1", plan: "free" },
    });
    expect(result.plan).toBe("empresarial");
    expect(result.source).toBe("COMPANY");
    expect(result.billableSubscription).toBe(false);
  });

  it("ignores a canceled subscription and falls back to the profile", () => {
    const result = resolveAdminPlan({
      subscription: { user_id: "u1", plan: "pro", status: "canceled", amount: 25.9 },
      profile: { user_id: "u1", plan: "plus" },
    });
    expect(result.plan).toBe("plus");
    expect(result.source).toBe("PROFILE");
    expect(result.subscriptionActive).toBe(false);
    expect(result.billableSubscription).toBe(false);
  });

  it("uses the default free plan when no operational source exists", () => {
    const result = resolveAdminPlan({});
    expect(result.plan).toBe("free");
    expect(result.source).toBe("DEFAULT");
  });

  it("reports orphan records and plan divergences without changing data", () => {
    const result = buildAdminPlanIndex({
      authUsers: [{ id: "u1", created_at: "2026-01-01T00:00:00Z" } as never],
      profiles: [{ user_id: "u1", plan: "free" }],
      billingUsers: [],
      memberships: [],
      companies: [],
      subscriptions: [{ user_id: "orphan", plan: "pro", status: "active" }],
    });
    expect(result.integrity.authWithoutBillingUser).toBe(1);
    expect(result.integrity.subscriptionsWithoutUser).toBe(1);
    expect(result.integrity.planDivergences).toBe(0);
  });
});

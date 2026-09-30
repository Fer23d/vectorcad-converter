import { describe, expect, it, vi } from "vitest";

describe("admin overview user access status compatibility", () => {
  it("falls back when access status columns are not migrated yet", async () => {
    vi.resetModules();
    const selectCalls: string[] = [];
    const authUser = {
      id: "user-1",
      email: "user@example.com",
      created_at: "2026-09-30T12:00:00Z",
      last_sign_in_at: null,
      user_metadata: { access_status: "blocked" },
    };
    const adminClient = {
      from: (table: string) => ({
        select: (columns: string) => {
          selectCalls.push(`${table}:${columns}`);
          if (table === "projects") return { order: vi.fn().mockResolvedValue({ data: [], error: null }) };
          if (table === "companies") return { order: vi.fn().mockResolvedValue({ data: [], error: null }) };
          if (table === "admin_logs") return { order: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) })) };
          if (table === "user_roles") return Promise.resolve({ data: [], error: null });
          if (table === "users" && columns.includes("status")) {
            return Promise.resolve({ data: null, error: { code: "42703", message: "column users.status does not exist" } });
          }
          if (table === "users") return Promise.resolve({ data: [{ id: "user-1", email: "user@example.com", plan: "free", is_premium: false, company: null, company_id: null }], error: null });
          if (table === "profiles" && columns.includes("status")) {
            return Promise.resolve({ data: null, error: { code: "42703", message: "column profiles.status does not exist" } });
          }
          if (table === "profiles") return Promise.resolve({ data: [{ user_id: "user-1", plan: "free", is_premium: false, company: null, company_id: null }], error: null });
          if (table === "companies_users") return Promise.resolve({ data: [], error: null });
          if (table === "subscriptions") return Promise.resolve({ data: [], error: null });
          return Promise.resolve({ data: [], error: null });
        },
      }),
    };

    vi.doMock("@/lib/admin-auth", () => ({
      requireAdmin: vi.fn().mockResolvedValue({
        adminClient,
        role: "ADMIN",
        user: { id: "admin-1", email: "admin@example.com", user_metadata: {} },
      }),
    }));
    vi.doMock("@/lib/admin-plan-resolution", async () => {
      const actual = await vi.importActual<typeof import("@/lib/admin-plan-resolution")>("@/lib/admin-plan-resolution");
      return {
        ...actual,
        listAllAuthUsers: vi.fn().mockResolvedValue([authUser]),
      };
    });

    const { GET } = await import("@/app/api/admin/overview/route");
    const response = await GET(new Request("http://localhost/api/admin/overview"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.users[0].status).toBe("blocked");
    expect(selectCalls).toContain("users:id,email,company,company_id,plan,is_premium,status");
    expect(selectCalls).toContain("users:id,email,company,company_id,plan,is_premium");
    expect(selectCalls).toContain("profiles:user_id,plan,is_premium,company,company_id,status");
    expect(selectCalls).toContain("profiles:user_id,plan,is_premium,company,company_id");
  });
});

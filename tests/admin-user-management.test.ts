import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminWithMFA = vi.fn();
const getUserById = vi.fn();
const updateUserById = vi.fn();
const deleteUser = vi.fn();
const maybeSingle = vi.fn();
const insert = vi.fn();
const upsert = vi.fn();
const deleteEq = vi.fn();
const storageList = vi.fn();
const storageRemove = vi.fn();

vi.mock("@/lib/admin-auth", () => ({
  requireAdminWithMFA,
}));

function adminClient() {
  return {
    auth: {
      admin: {
        getUserById,
        updateUserById,
        deleteUser,
      },
    },
    storage: {
      from: () => ({
        list: storageList,
        remove: storageRemove,
      }),
    },
    from: (table: string) => ({
      insert,
      upsert,
      select: () => ({
        eq: () => table === "projects"
          ? Promise.resolve({ data: [{ id: "project-1", user_id: "user-1" }], error: null })
          : { maybeSingle },
      }),
      delete: () => ({
        eq: (_column: string, value: string) => deleteEq(table, value),
      }),
    }),
  };
}

function adminAuth(overrides: Record<string, unknown> = {}) {
  return {
    adminClient: adminClient(),
    user: { id: "admin-1", email: "admin@example.com" },
    role: "ADMIN",
    token: "aal2-token",
    ...overrides,
  };
}

function request(body: Record<string, unknown>, method = "PATCH") {
  return new Request("http://localhost/api/admin/users/user-1", {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer aal2-token" },
    body: JSON.stringify(body),
  });
}

describe("admin user access management", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireAdminWithMFA.mockResolvedValue(adminAuth());
    getUserById.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@example.com", user_metadata: {} } },
      error: null,
    });
    updateUserById.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    deleteUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: "USER" }, error: null });
    insert.mockResolvedValue({ error: null });
    upsert.mockResolvedValue({ error: null });
    deleteEq.mockResolvedValue({ error: null });
    storageList.mockResolvedValue({ data: [{ name: "source.png" }, { name: "processed.png" }], error: null });
    storageRemove.mockResolvedValue({ data: [], error: null });
  });

  it("requires ADMIN with MFA before revoking access", async () => {
    requireAdminWithMFA.mockResolvedValue({ response: Response.json({ error: "MFA_REQUIRED" }, { status: 403 }) });
    const { PATCH } = await import("@/app/api/admin/users/[id]/access/route");
    const response = await PATCH(request({ status: "blocked" }), { params: Promise.resolve({ id: "user-1" }) });

    expect(response.status).toBe(403);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("revokes access without deleting user data", async () => {
    const { PATCH } = await import("@/app/api/admin/users/[id]/access/route");
    const response = await PATCH(request({ status: "blocked" }), { params: Promise.resolve({ id: "user-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("blocked");
    expect(updateUserById).toHaveBeenCalledWith("user-1", expect.objectContaining({ ban_duration: "876000h" }));
    expect(deleteUser).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ action: "user.access_revoked" })]);
  });

  it("restores access using the existing account", async () => {
    const { PATCH } = await import("@/app/api/admin/users/[id]/access/route");
    const response = await PATCH(request({ status: "active" }), { params: Promise.resolve({ id: "user-1" }) });

    expect(response.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith("user-1", expect.objectContaining({ ban_duration: "none" }));
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ action: "user.access_restored" })]);
  });

  it("does not allow an admin to block their own account", async () => {
    const { PATCH } = await import("@/app/api/admin/users/[id]/access/route");
    const response = await PATCH(request({ status: "blocked" }), { params: Promise.resolve({ id: "admin-1" }) });

    expect(response.status).toBe(400);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("requires EXCLUIR confirmation before permanent deletion", async () => {
    const { DELETE } = await import("@/app/api/admin/users/[id]/route");
    const response = await DELETE(request({ confirmation: "delete" }, "DELETE"), { params: Promise.resolve({ id: "user-1" }) });

    expect(response.status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("blocks self deletion", async () => {
    const { DELETE } = await import("@/app/api/admin/users/[id]/route");
    const response = await DELETE(request({ confirmation: "EXCLUIR" }, "DELETE"), { params: Promise.resolve({ id: "admin-1" }) });

    expect(response.status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("does not claim success when storage cleanup fails", async () => {
    storageList.mockResolvedValue({ data: null, error: { message: "storage unavailable" } });
    const { DELETE } = await import("@/app/api/admin/users/[id]/route");
    const response = await DELETE(request({ confirmation: "EXCLUIR" }, "DELETE"), { params: Promise.resolve({ id: "user-1" }) });

    expect(response.status).toBe(500);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ action: "user.delete_permanently_failed" })]);
  });

  it("deletes only target owned project storage before removing the auth user", async () => {
    const { DELETE } = await import("@/app/api/admin/users/[id]/route");
    const response = await DELETE(request({ confirmation: "EXCLUIR" }, "DELETE"), { params: Promise.resolve({ id: "user-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(storageRemove).toHaveBeenCalledWith(["project-1/source.png", "project-1/processed.png"]);
    expect(deleteUser).toHaveBeenCalledWith("user-1");
    expect(body.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ action: "user.delete_permanently" })]);
  });
});

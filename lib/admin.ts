export const ADMIN_USER_ID = "7f90fdcd-05e6-4b8c-8bbb-977a37b5901c";
export const ADMIN_EMAIL = "admin@vetorcad.com.br";

export const ADMIN_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

export type AdminRole = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES];

export function normalizeAdminRole(value?: unknown): AdminRole {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === ADMIN_ROLES.SUPER_ADMIN) return ADMIN_ROLES.SUPER_ADMIN;
  if (normalized === ADMIN_ROLES.ADMIN) return ADMIN_ROLES.ADMIN;
  return ADMIN_ROLES.USER;
}

export function getUserRole(user?: { email?: string | null; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null): AdminRole {
  const metadataRole = normalizeAdminRole(user?.app_metadata?.role || user?.user_metadata?.role || user?.user_metadata?.admin_role);
  if (metadataRole !== ADMIN_ROLES.USER) return metadataRole;
  if (String(user?.email || "").toLowerCase() === ADMIN_EMAIL) return ADMIN_ROLES.SUPER_ADMIN;
  return ADMIN_ROLES.USER;
}

export function isAdminRole(role?: AdminRole | null) {
  return role === ADMIN_ROLES.SUPER_ADMIN || role === ADMIN_ROLES.ADMIN;
}

export function isAdminUser(user?: { id?: string | null; email?: string | null; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | string | null) {
  if (typeof user === "string") return user === ADMIN_USER_ID;
  if (!user) return false;
  return user.id === ADMIN_USER_ID || isAdminRole(getUserRole(user));
}

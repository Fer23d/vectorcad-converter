export const ADMIN_ROLES = {
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

export type AdminRole = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES];

export function normalizeAdminRole(value?: unknown): AdminRole {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === ADMIN_ROLES.ADMIN) return ADMIN_ROLES.ADMIN;
  return ADMIN_ROLES.USER;
}

export function getUserRole(databaseRole?: unknown): AdminRole {
  return normalizeAdminRole(databaseRole);
}

export function isAdminRole(role?: AdminRole | null) {
  return role === ADMIN_ROLES.ADMIN;
}

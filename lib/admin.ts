export const ADMIN_USER_ID = "7f90fdcd-05e6-4b8c-8bbb-977a37b5901c";

export function isAdminUser(userId?: string | null) {
  return userId === ADMIN_USER_ID;
}

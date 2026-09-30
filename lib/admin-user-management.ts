import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const PROJECT_IMAGES_BUCKET = "project-images";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type ProjectRow = {
  id: string;
  name?: string | null;
  user_id: string;
};

function isMissingRelation(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() || "";
  return error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST205" || message.includes("schema cache");
}

export async function logAdminAction(adminClient: SupabaseAdminClient, adminId: string, action: string, targetType: string, targetId: string, metadata: Record<string, unknown> = {}) {
  const { error } = await adminClient.from("admin_logs").insert([{ admin_id: adminId, action, target_type: targetType, target_id: targetId, metadata }]);
  if (error && !isMissingRelation(error)) throw error;
}

async function deleteProjectStorageFolder(adminClient: SupabaseAdminClient, projectId: string) {
  const { data, error } = await adminClient.storage.from(PROJECT_IMAGES_BUCKET).list(projectId, { limit: 1000 });
  if (error) throw error;
  const objectPaths = (data || [])
    .filter((item) => item.name && !item.name.endsWith("/"))
    .map((item) => `${projectId}/${item.name}`);
  if (!objectPaths.length) return 0;
  const { error: removeError } = await adminClient.storage.from(PROJECT_IMAGES_BUCKET).remove(objectPaths);
  if (removeError) throw removeError;
  return objectPaths.length;
}

export async function deleteUserProjectStorage(adminClient: SupabaseAdminClient, projects: ProjectRow[]) {
  let removedObjects = 0;
  for (const project of projects) {
    removedObjects += await deleteProjectStorageFolder(adminClient, project.id);
  }
  return removedObjects;
}

async function deleteOptionalUserRows(adminClient: SupabaseAdminClient, table: string, column: string, userId: string) {
  const { error } = await adminClient.from(table).delete().eq(column, userId);
  if (error && !isMissingRelation(error)) throw error;
}

export async function deleteUserPermanently(adminClient: SupabaseAdminClient, target: User) {
  const { data: projects, error: projectsError } = await adminClient
    .from("projects")
    .select("id,name,user_id")
    .eq("user_id", target.id);
  if (projectsError) throw projectsError;

  const projectRows = (projects || []) as ProjectRow[];
  const storageObjectsDeleted = await deleteUserProjectStorage(adminClient, projectRows);

  await deleteOptionalUserRows(adminClient, "user_locations", "user_id", target.id);
  await deleteOptionalUserRows(adminClient, "companies_users", "user_id", target.id);
  await deleteOptionalUserRows(adminClient, "user_academy_progress", "user_id", target.id);
  await deleteOptionalUserRows(adminClient, "subscriptions", "user_id", target.id);
  await deleteOptionalUserRows(adminClient, "projects", "user_id", target.id);
  await deleteOptionalUserRows(adminClient, "user_roles", "user_id", target.id);
  await deleteOptionalUserRows(adminClient, "profiles", "user_id", target.id);
  await deleteOptionalUserRows(adminClient, "users", "id", target.id);

  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(target.id);
  if (deleteUserError) throw deleteUserError;

  return {
    projectCount: projectRows.length,
    storageObjectsDeleted,
  };
}

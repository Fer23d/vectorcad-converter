import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/server";

export type UserAccessStatus = "active" | "blocked";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

function isMissingAccessColumn(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() || "";
  return error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST205" || message.includes("status") || message.includes("schema cache");
}

export function normalizeUserAccessStatus(value: unknown): UserAccessStatus {
  return value === "blocked" ? "blocked" : "active";
}

export async function getUserAccessStatus(adminClient: SupabaseAdminClient, userId: string): Promise<UserAccessStatus> {
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError && !isMissingAccessColumn(profileError)) throw profileError;
  if (profile?.status === "blocked") return "blocked";

  const { data: appUser, error: userError } = await adminClient
    .from("users")
    .select("status")
    .eq("id", userId)
    .maybeSingle();

  if (userError && !isMissingAccessColumn(userError)) throw userError;
  return normalizeUserAccessStatus(appUser?.status || profile?.status);
}

export async function setUserAccessStatus(adminClient: SupabaseAdminClient, user: User, status: UserAccessStatus) {
  const now = new Date().toISOString();
  const metadata = {
    ...(user.user_metadata || {}),
    access_status: status,
    access_status_updated_at: now,
  };

  const { error: authError } = await adminClient.auth.admin.updateUserById(user.id, {
    ban_duration: status === "blocked" ? "876000h" : "none",
    user_metadata: metadata,
  });
  if (authError) throw authError;

  const { error: profileError } = await adminClient.from("profiles").upsert({
    user_id: user.id,
    status,
    updated_at: now,
  }, { onConflict: "user_id" });
  if (profileError && !isMissingAccessColumn(profileError)) throw profileError;

  const { error: publicUserError } = await adminClient.from("users").upsert({
    id: user.id,
    email: user.email || null,
    status,
    updated_at: now,
  }, { onConflict: "id" });
  if (publicUserError && !isMissingAccessColumn(publicUserError)) throw publicUserError;
}

export async function requireActiveUser(userId: string) {
  if (!isSupabaseAdminConfigured) return null;
  const adminClient = createSupabaseAdminClient();
  const status = await getUserAccessStatus(adminClient, userId);
  if (status === "blocked") {
    return NextResponse.json({ error: "Acesso revogado. Entre em contato com o administrador." }, { status: 403 });
  }
  return null;
}

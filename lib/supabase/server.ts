import { createClient } from "@supabase/supabase-js";

function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "") || "";
}

const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const supabaseServiceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

export const isSupabaseServerConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const isSupabaseAdminConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);

export function createSupabaseAuthServerClient(accessToken?: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    auth: { persistSession: false },
  });
}

export function createSupabaseAdminClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

"use client";

import { createClient } from "@supabase/supabase-js";

function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "") || "";
}

function isValidSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function isLikelySupabaseAnonKey(value: string) {
  if (value.startsWith("sb_publishable_")) {
    return value.length > 30;
  }

  const parts = value.split(".");
  return parts.length === 3 && value.length > 80;
}

const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const isSupabaseConfigured =
  isValidSupabaseUrl(supabaseUrl) && isLikelySupabaseAnonKey(supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

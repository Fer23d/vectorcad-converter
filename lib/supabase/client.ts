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
const supabaseAnonKey = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export function inspectSupabaseConfig(url: string | undefined, anonKey: string | undefined) {
  const cleanUrl = cleanEnv(url);
  const cleanKey = cleanEnv(anonKey);
  return {
    urlPresent: Boolean(cleanUrl),
    anonKeyPresent: Boolean(cleanKey),
    urlValid: isValidSupabaseUrl(cleanUrl),
    anonKeyValid: isLikelySupabaseAnonKey(cleanKey),
    configured: isValidSupabaseUrl(cleanUrl) && isLikelySupabaseAnonKey(cleanKey),
  };
}

export const supabaseConfig = inspectSupabaseConfig(supabaseUrl, supabaseAnonKey);
export const isSupabaseConfigured = supabaseConfig.configured;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

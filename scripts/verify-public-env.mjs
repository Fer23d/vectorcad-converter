function clean(value) {
  return String(value || "").trim().replace(/^[\"']|[\"']$/g, "");
}

const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const key = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const validUrl = /^https:\/\/[^/]+\.supabase\.co(?:\/.*)?$/.test(url);
const validKey = Boolean(key) && !key.startsWith("sb_secret_") && !key.startsWith("service_role");

console.log(`SUPABASE_PUBLIC_CONFIG: ${validUrl && validKey ? "OK" : "MISSING"}`);

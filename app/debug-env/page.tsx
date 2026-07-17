import { DebugEnvStatus } from "@/components/debug-env-status";

export const dynamic = "force-dynamic";

export default function DebugEnvPage() {
  const serverUrlPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
  const serverKeyPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  console.info(`[SUPABASE_RUNTIME_CONFIG] URL=${serverUrlPresent ? "FOUND" : "MISSING"} KEY=${serverKeyPresent ? "FOUND" : "MISSING"}`);
  return <DebugEnvStatus serverUrlPresent={serverUrlPresent} serverKeyPresent={serverKeyPresent} />;
}

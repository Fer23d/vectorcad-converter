"use client";

import { supabaseConfig } from "@/lib/supabase/client";

export function DebugEnvStatus({ serverUrlPresent, serverKeyPresent }: { serverUrlPresent: boolean; serverKeyPresent: boolean }) {
  return <main className="grid min-h-screen place-items-center bg-[#080c0b] px-4 text-[#e8efeb]">
    <section className="w-full max-w-xl rounded-2xl border border-[#33413a] bg-[#101613] p-6">
      <p className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">VectorCAD diagnostics</p>
      <h1 className="mt-3 text-2xl font-black">Supabase público</h1>
      <div className="mt-6 space-y-3 text-sm">
        <Status label="NEXT_PUBLIC_SUPABASE_URL" found={supabaseConfig.urlPresent} />
        <Status label="NEXT_PUBLIC_SUPABASE_ANON_KEY" found={supabaseConfig.anonKeyPresent} />
      </div>
      <div className="mt-6 border-t border-[#26312c] pt-4 text-xs text-[#8e9d95]">
        <p>Server runtime</p>
        <p className={serverUrlPresent ? "text-[#b7f34a]" : "text-[#ff8b87]"}>{serverUrlPresent ? "FOUND" : "MISSING"} · SUPABASE_URL público</p>
        <p className={serverKeyPresent ? "text-[#b7f34a]" : "text-[#ff8b87]"}>{serverKeyPresent ? "FOUND" : "MISSING"} · SUPABASE_KEY pública</p>
      </div>
    </section>
  </main>;
}

function Status({ label, found }: { label: string; found: boolean }) {
  return <div className="flex items-center justify-between rounded-lg border border-[#26312c] bg-[#0b100e] px-3 py-3">
    <span>{label}</span>
    <b className={found ? "text-[#b7f34a]" : "text-[#ff8b87]"}>{found ? "FOUND" : "MISSING"}</b>
  </div>;
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      router.replace("/login");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      router.replace(data.session ? "/dashboard" : "/login");
    });
  }, [router]);

  return <main className="grid min-h-screen place-items-center bg-[#080c0b] text-[#e8efeb]">
    <div className="text-xs uppercase tracking-[.18em] text-[#b7f34a]">Carregando VectorCAD...</div>
  </main>;
}

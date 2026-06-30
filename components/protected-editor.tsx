"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { VectorCadApp } from "@/components/vector-cad-app";

export function ProtectedEditor() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      router.replace("/login");
      return;
    }

    client.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }

      setAllowed(true);
    });
  }, [router]);

  if (!allowed) {
    return <main className="grid min-h-screen place-items-center bg-[#080c0b] text-[#e8efeb]">
      <div className="text-xs uppercase tracking-[.18em] text-[#b7f34a]">Carregando editor...</div>
    </main>;
  }

  return <VectorCadApp />;
}

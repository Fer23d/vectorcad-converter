"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Box, LoaderCircle } from "lucide-react";
import { SvgTo3DCadViewer } from "@/components/SvgTo3DCadViewer";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { generateSvg } from "@/lib/exporters/svg";
import { scaleDocument } from "@/lib/vectorize/contours";
import type { CadProject, CadProjectData } from "@/types/project";

type ViewerState = { project: CadProject; svg: string; unit: string; fileName?: string };

export function ProtectedProject3DViewer() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<ViewerState | null>(null);
  const [message, setMessage] = useState("Carregando projeto 3D...");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isSupabaseConfigured || !supabase) {
        router.replace("/login");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.email_confirmed_at) {
        router.replace(`/verify-email?email=${encodeURIComponent(userData.user?.email || "")}`);
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .select("id,user_id,name,type,data,created_at,updated_at")
        .eq("id", params.id)
        .eq("user_id", userData.user.id)
        .single();

      if (cancelled) return;
      if (error || !data) {
        setMessage("Projeto não encontrado ou sem permissão de acesso.");
        return;
      }

      const project = data as CadProject;
      const projectData = project.data as CadProjectData | null;
      const document = projectData?.document;
      if (!projectData || !document) {
        setMessage("Este projeto ainda não possui um vetor para visualizar em 3D.");
        return;
      }

      const width = projectData.realWidth || document.width;
      const height = projectData.realHeight || document.height;
      const unit = projectData.unit || document.unit;
      const scaledDocument = scaleDocument(document, width, height, unit);
      setState({ project, svg: generateSvg(scaledDocument), unit, fileName: projectData.fileName });
    };

    void load();
    return () => { cancelled = true; };
  }, [params.id, router]);

  return <main className="min-h-screen bg-[radial-gradient(circle_at_50%_-20%,#1d3428_0,#080c0b_42%)] text-[#e8efeb]">
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[#26312c] px-4 py-3 md:px-7">
      <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#b7f34a] text-[#09120d]"><Box size={20} /></div><div><div className="text-sm font-black tracking-[.12em]">VectorCAD</div><div className="text-[9px] tracking-[.28em] text-[#7e9187]">Visualizador 3D</div></div></div>
      {state && <div className="order-3 w-full text-center text-xs text-[#aab8b1] md:order-none md:w-auto"><span className="text-[#7e9187]">Projeto:</span> <strong className="text-[#b7f34a]">{state.project.name}</strong></div>}
      <button type="button" onClick={() => router.push("/dashboard")} className="flex items-center gap-2 rounded-lg border border-[#34413b] px-3 py-2 text-xs font-bold text-[#dce8e1] transition hover:border-[#b7f34a] hover:text-[#b7f34a]"><ArrowLeft size={14} /> Voltar ao projeto</button>
    </header>
    <section className="mx-auto max-w-[1600px] p-4 md:p-7">
      {state ? <SvgTo3DCadViewer svg={state.svg} fileName={state.fileName} unit={state.unit} /> : <div className="grid min-h-[70vh] place-items-center rounded-2xl border border-[#26312c] bg-[#101613] px-6 text-center"><div><LoaderCircle className="mx-auto animate-spin text-[#b7f34a]" size={28} /><p className="mt-4 text-sm font-bold text-[#dce8e1]">{message}</p><button type="button" onClick={() => router.push("/dashboard")} className="mt-5 rounded-lg border border-[#34413b] px-4 py-2 text-xs font-bold text-[#b7f34a]">Voltar ao dashboard</button></div></div>}
    </section>
  </main>;
}

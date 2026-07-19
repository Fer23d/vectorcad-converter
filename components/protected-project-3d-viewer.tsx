"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Box, LoaderCircle } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Carregando visualizador 3D...");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const projectId = typeof params.id === "string" ? params.id : "";
      console.info("[vetorcad][3D] route opened", {
        pathname: window.location.pathname,
        hasProjectId: Boolean(projectId),
      });

      try {
        if (!projectId) throw new Error("PROJECT_ID_MISSING");
        if (!isSupabaseConfigured || !supabase) {
          router.replace("/login");
          return;
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        console.info("[vetorcad][3D] session check", {
          hasSession: Boolean(sessionData.session),
          errorCode: sessionError?.status || null,
        });
        if (!sessionData.session) {
          router.replace("/login");
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          console.info("[vetorcad][3D] user check failed", { errorCode: userError?.status || null });
          router.replace("/login");
          return;
        }
        if (!userData.user.email_confirmed_at) {
          router.replace(`/verify-email?email=${encodeURIComponent(userData.user.email || "")}`);
          return;
        }

        const { data, error } = await supabase
          .from("projects")
          .select("id,user_id,name,type,data,created_at,updated_at")
          .eq("id", projectId)
          .eq("user_id", userData.user.id)
          .single();
        console.info("[vetorcad][3D] project query", { found: Boolean(data), errorCode: error?.code || null });

        if (cancelled) return;
        if (error || !data) throw new Error("PROJECT_NOT_FOUND");

        const project = data as CadProject;
        const projectData = project.data as CadProjectData | null;
        const document = projectData?.document;
        if (!projectData || !document || !document.paths?.length) throw new Error("VECTOR_NOT_AVAILABLE");

        const width = projectData.realWidth || document.width;
        const height = projectData.realHeight || document.height;
        const unit = projectData.unit || document.unit;
        const svg = generateSvg(scaleDocument(document, width, height, unit));
        if (!svg) throw new Error("SVG_NOT_GENERATED");
        setState({ project, svg, unit, fileName: projectData.fileName });
      } catch (error) {
        if (cancelled) return;
        console.error("[vetorcad][3D] load failed", { code: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
        setMessage(error instanceof Error && error.message === "VECTOR_NOT_AVAILABLE"
          ? "Este projeto ainda nao possui um vetor para visualizar em 3D."
          : "Nao foi possivel carregar o visualizador 3D deste projeto.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [params.id, router]);

  return <main className="min-h-screen bg-[radial-gradient(circle_at_50%_-20%,#1d3428_0,#080c0b_42%)] text-[#e8efeb]">
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[#26312c] px-4 py-3 md:px-7">
      <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#b7f34a] text-[#09120d]"><Box size={20} /></div><div><div className="text-sm font-black tracking-[.12em]">vetorcad</div><div className="text-[9px] tracking-[.28em] text-[#7e9187]">Visualizador 3D</div></div></div>
      {state && <div className="order-3 w-full text-center text-xs text-[#aab8b1] md:order-none md:w-auto"><span className="text-[#7e9187]">Projeto:</span> <strong className="text-[#b7f34a]">{state.project.name}</strong></div>}
      <button type="button" onClick={() => router.push("/dashboard")} className="flex items-center gap-2 rounded-lg border border-[#34413b] px-3 py-2 text-xs font-bold text-[#dce8e1] transition hover:border-[#b7f34a] hover:text-[#b7f34a]"><ArrowLeft size={14} /> Voltar ao projeto</button>
    </header>
    <section className="mx-auto max-w-[1600px] p-4 md:p-7">
      {state ? <SvgTo3DCadViewer svg={state.svg} fileName={state.fileName} unit={state.unit} /> : <div className="grid min-h-[70vh] place-items-center rounded-2xl border border-[#26312c] bg-[#101613] px-6 text-center"><div>{loading ? <LoaderCircle className="mx-auto animate-spin text-[#b7f34a]" size={28} /> : <AlertCircle className="mx-auto text-[#f0b45b]" size={28} />}<p className="mt-4 text-sm font-bold text-[#dce8e1]">{message}</p><button type="button" onClick={() => router.push("/dashboard")} className="mt-5 rounded-lg border border-[#34413b] px-4 py-2 text-xs font-bold text-[#b7f34a]">Voltar ao dashboard</button></div></div>}
    </section>
  </main>;
}

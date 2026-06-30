"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Clock3, FilePlus2, FolderOpen, LogOut, ShieldCheck } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { VectorCadApp } from "@/components/vector-cad-app";
import type { CadProject, CadProjectData } from "@/types/project";

const emptyProjectData: CadProjectData = {
  notes: "",
  editorMode: "cad2d",
};

export function SaasDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [projects, setProjects] = useState<CadProject[]>([]);
  const [activeProject, setActiveProject] = useState<CadProject | null>(null);
  const [status, setStatus] = useState("Conectando ao Supabase...");

  const canUseSupabase = isSupabaseConfigured && supabase;

  const loadProjects = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      setStatus(`Nao foi possivel carregar projetos: ${error.message}`);
      return;
    }

    setProjects((data || []) as CadProject[]);
    setStatus(data?.length ? "Projetos carregados. O conversor esta pronto para uso." : "Conversor pronto. Crie um projeto para salvar seu workspace.");
  }, []);

  const openProject = useCallback(async (projectId: string) => {
    if (!supabase || !user) return;
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (error) {
      setStatus(`Nao foi possivel abrir o projeto: ${error.message}`);
      return;
    }

    const project = data as CadProject;
    const updatedAt = new Date().toISOString();
    const nextData = { ...(project.data || emptyProjectData), lastOpenedAt: updatedAt };

    setActiveProject({ ...project, data: nextData, updated_at: updatedAt });
    setStatus(`Projeto aberto: ${project.name}`);

    await supabase
      .from("projects")
      .update({ data: nextData, updated_at: updatedAt })
      .eq("id", project.id)
      .eq("user_id", user.id);
  }, [user]);

  const createProject = useCallback(async () => {
    if (!supabase || !user) return;
    const name = window.prompt("Nome do novo projeto CAD", `Projeto ${projects.length + 1}`);
    if (!name?.trim()) return;

    const initialData: CadProjectData = {
      ...emptyProjectData,
      lastOpenedAt: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("projects")
      .insert([{ user_id: user.id, name: name.trim(), type: "2d", data: initialData }])
      .select("*")
      .single();

    if (error) {
      setStatus(`Nao foi possivel criar o projeto: ${error.message}`);
      return;
    }

    setProjects((current) => [data as CadProject, ...current]);
    setActiveProject(data as CadProject);
    setStatus(`Projeto criado: ${(data as CadProject).name}`);
  }, [projects.length, user]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    client.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
      if (data.user) loadProjects(data.user.id);
      else router.replace("/login");
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setActiveProject(null);
      setProjects([]);
      if (session?.user) loadProjects(session.user.id);
      else router.replace("/login");
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProjects, router]);

  useEffect(() => {
    const client = supabase;
    if (!client || !user) return;
    const channel = client
      .channel(`projects-user-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: `user_id=eq.${user.id}` }, () => {
        loadProjects(user.id);
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [loadProjects, user]);

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setActiveProject(null);
    setProjects([]);
    router.replace("/login");
  };

  const sortedProjects = useMemo(() => [...projects].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()), [projects]);

  if (!canUseSupabase) {
    return <main className="min-h-screen bg-[#080c0b] p-6 text-[#e8efeb]">
      <div className="mx-auto mt-20 max-w-xl rounded-2xl border border-[#33413a] bg-[#101613] p-6">
        <h1 className="text-xl font-black">Supabase nao configurado</h1>
        <p className="mt-3 text-sm leading-6 text-[#9caaa3]">Adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no Vercel/local para ativar login, dashboard e projetos.</p>
      </div>
    </main>;
  }

  if (authLoading || !user) {
    return <main className="grid min-h-screen place-items-center bg-[#080c0b] text-[#e8efeb]">
      <div className="text-xs uppercase tracking-[.18em] text-[#b7f34a]">Carregando sessao...</div>
    </main>;
  }

  return <main className="flex min-h-screen flex-col bg-[#080c0b] text-[#e8efeb] lg:flex-row">
    <aside id="sidebar" className="flex max-h-[42vh] w-full shrink-0 flex-col border-b border-[#26312c] bg-[#0d1210] lg:max-h-none lg:w-[310px] lg:border-b-0 lg:border-r">
      <div className="border-b border-[#26312c] p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#b7f34a] text-[#09120d]"><FolderOpen size={18} /></div>
          <div>
            <div className="text-xs font-black uppercase tracking-[.18em]">Projetos CAD</div>
            <div className="text-[10px] text-[#84938b]">{user.email}</div>
          </div>
        </div>
        <button onClick={createProject} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#b7f34a] py-2.5 text-xs font-black text-[#09120d]"><FilePlus2 size={14} /> Novo Projeto</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {sortedProjects.map((project) => <button key={project.id} onClick={() => openProject(project.id)} className={`mb-2 w-full rounded-xl border p-3 text-left transition ${activeProject?.id === project.id ? "border-[#b7f34a] bg-[#182318]" : "border-[#26312c] bg-[#111815] hover:border-[#53625b]"}`}>
          <div className="text-sm font-bold">{project.name}</div>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-[#819087]"><Clock3 size={11} /> {new Date(project.updated_at).toLocaleString("pt-BR")}</div>
        </button>)}
        {!sortedProjects.length && <div className="rounded-xl border border-dashed border-[#34413b] p-4 text-center text-xs text-[#8b9a92]">Nenhum projeto salvo. O conversor ja esta liberado.</div>}
      </div>

      <button onClick={signOut} className="m-3 flex items-center justify-center gap-2 rounded-lg border border-[#34413b] py-2 text-xs text-[#a7b3ad]"><LogOut size={14} /> Sair</button>
    </aside>

    <section id="main" className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[#26312c] px-5 py-4">
        <div>
          <h1 className="text-lg font-black">{activeProject?.name || "Workspace VectorCAD"}</h1>
          <p className="text-xs text-[#8c9a93]">{status}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#b7f34a]"><ShieldCheck size={14} /> sessao protegida</div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <VectorCadApp />
      </div>
    </section>
  </main>;
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Box, Clock3, FilePlus2, FolderOpen, LogOut, Save, ShieldCheck, Sparkles } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type { CadProject, CadProjectData } from "@/types/project";

const emptyProjectData: CadProjectData = {
  notes: "",
  editorMode: "cad2d",
};

function projectData(project: CadProject | null): CadProjectData {
  return project?.data || emptyProjectData;
}

export function SaasDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [projects, setProjects] = useState<CadProject[]>([]);
  const [activeProject, setActiveProject] = useState<CadProject | null>(null);
  const [draft, setDraft] = useState<CadProjectData>(emptyProjectData);
  const [status, setStatus] = useState("Conectando ao Supabase...");
  const [saving, setSaving] = useState(false);
  const autosaveReady = useRef(false);

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
    setStatus(data?.length ? "Projetos carregados." : "Nenhum projeto ainda. Crie o primeiro.");
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
    autosaveReady.current = false;
    setActiveProject(project);
    setDraft(projectData(project));
    window.requestAnimationFrame(() => {
      autosaveReady.current = true;
    });
    setStatus(`Projeto aberto: ${project.name}`);
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
    await openProject((data as CadProject).id);
  }, [openProject, projects.length, user]);

  const autoSave = useCallback(async (projectId: string, data: CadProjectData) => {
    if (!supabase || !user) return;
    setSaving(true);
    const updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from("projects")
      .update({ data, updated_at: updatedAt })
      .eq("id", projectId)
      .eq("user_id", user.id);

    setSaving(false);
    if (error) {
      setStatus(`Autosave falhou: ${error.message}`);
      return;
    }

    setProjects((current) => current.map((project) => project.id === projectId ? { ...project, data, updated_at: updatedAt } : project));
    setActiveProject((current) => current?.id === projectId ? { ...current, data, updated_at: updatedAt } : current);
    setStatus("Projeto salvo automaticamente na nuvem.");
  }, [user]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    client.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
      if (data.user) loadProjects(data.user.id);
      else setStatus("Faca login para acessar seus projetos.");
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setActiveProject(null);
      setProjects([]);
      if (session?.user) loadProjects(session.user.id);
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProjects]);

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

  useEffect(() => {
    if (!activeProject || !autosaveReady.current) return;
    const timer = window.setTimeout(() => {
      autoSave(activeProject.id, draft);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activeProject, autoSave, draft]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);
    if (error) setStatus(`Login falhou: ${error.message}`);
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setActiveProject(null);
    setProjects([]);
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

  if (!user) {
    return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_50%_-20%,#1d3428_0,#080c0b_42%)] p-5">
      <form onSubmit={signIn} className="w-full max-w-sm rounded-2xl border border-[#33413a] bg-[#101613] p-6 text-[#e8efeb] shadow-2xl">
        <div className="mb-6 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#b7f34a] text-[#09120d]"><Box size={20} /></div><div><div className="text-sm font-black tracking-[.16em]">VECTORCAD</div><div className="text-[10px] text-[#84938b]">Dashboard SaaS</div></div></div>
        <label className="mb-3 block text-xs text-[#aab8b1]">Email<input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full" type="email" required /></label>
        <label className="mb-4 block text-xs text-[#aab8b1]">Senha<input value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full" type="password" required /></label>
        <button disabled={authLoading} className="w-full rounded-lg bg-[#b7f34a] py-3 text-xs font-black text-[#09120d] disabled:opacity-60">{authLoading ? "Entrando..." : "Entrar"}</button>
        <p className="mt-4 text-center text-[11px] text-[#8c9a93]">{status}</p>
      </form>
    </main>;
  }

  return <main className="flex min-h-screen bg-[#080c0b] text-[#e8efeb]">
    <aside id="sidebar" className="flex w-[310px] shrink-0 flex-col border-r border-[#26312c] bg-[#0d1210]">
      <div className="border-b border-[#26312c] p-4">
        <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#b7f34a] text-[#09120d]"><FolderOpen size={18} /></div><div><div className="text-xs font-black uppercase tracking-[.18em]">Projetos CAD</div><div className="text-[10px] text-[#84938b]">{user.email}</div></div></div>
        <button onClick={createProject} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#b7f34a] py-2.5 text-xs font-black text-[#09120d]"><FilePlus2 size={14} /> Novo Projeto</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {sortedProjects.map((project) => <button key={project.id} onClick={() => openProject(project.id)} className={`mb-2 w-full rounded-xl border p-3 text-left transition ${activeProject?.id === project.id ? "border-[#b7f34a] bg-[#182318]" : "border-[#26312c] bg-[#111815] hover:border-[#53625b]"}`}>
          <div className="text-sm font-bold">{project.name}</div>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-[#819087]"><Clock3 size={11} /> {new Date(project.updated_at).toLocaleString("pt-BR")}</div>
        </button>)}
        {!sortedProjects.length && <div className="rounded-xl border border-dashed border-[#34413b] p-4 text-center text-xs text-[#8b9a92]">Nenhum projeto salvo.</div>}
      </div>
      <button onClick={signOut} className="m-3 flex items-center justify-center gap-2 rounded-lg border border-[#34413b] py-2 text-xs text-[#a7b3ad]"><LogOut size={14} /> Sair</button>
    </aside>

    <section id="main" className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[#26312c] px-5 py-4">
        <div><h1 className="text-lg font-black">{activeProject?.name || "Dashboard VectorCAD"}</h1><p className="text-xs text-[#8c9a93]">{status}</p></div>
        <div className="flex items-center gap-2 text-xs text-[#b7f34a]"><ShieldCheck size={14} /> user_id protegido nas queries</div>
      </header>
      <div className="flex-1 overflow-y-auto p-5">
        {!activeProject && <div className="grid h-full place-items-center rounded-2xl border border-dashed border-[#33413a] bg-[#101613] p-8 text-center">
          <div><Sparkles className="mx-auto text-[#b7f34a]" /><h2 className="mt-4 text-xl font-black">Crie ou abra um projeto</h2><p className="mt-2 max-w-md text-sm text-[#9ba8a1]">Esta é a primeira base SaaS: autenticação, projetos por usuário, sidebar, abertura e autosave no Supabase.</p></div>
        </div>}
        {activeProject && <div className="grid gap-4">
          <div className="rounded-2xl border border-[#26312c] bg-[#101613] p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black uppercase tracking-[.14em]">Editor / Viewer</h2><div className="flex items-center gap-2 text-[10px] text-[#8c9a93]"><Save size={12} /> {saving ? "Salvando..." : "Autosave ativo"}</div></div>
            <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value, lastOpenedAt: new Date().toISOString() }))} className="min-h-[260px] w-full rounded-xl border border-[#34413b] bg-[#0b100e] p-3 text-sm text-[#e8efeb] outline-none focus:border-[#b7f34a]" placeholder="Dados iniciais do projeto CAD. O editor 2D/3D entra aqui na próxima etapa." />
          </div>
        </div>}
      </div>
    </section>
  </main>;
}

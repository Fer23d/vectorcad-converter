"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ChevronDown, ChevronUp, Clock3, FilePlus2, FolderOpen, LogOut, Settings, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { VectorCadApp } from "@/components/vector-cad-app";
import type { CadProject, CadProjectData } from "@/types/project";

type DashboardTab = "projects" | "editor" | "profile";

const emptyProjectData: CadProjectData = {
  notes: "",
  editorMode: "cad2d",
};

function metadataName(user: User | null) {
  return {
    firstName: String(user?.user_metadata?.first_name || ""),
    lastName: String(user?.user_metadata?.last_name || ""),
  };
}

const tabs: { id: DashboardTab; label: string; icon: React.ReactNode }[] = [
  { id: "projects", label: "Projetos", icon: <FolderOpen size={15} /> },
  { id: "editor", label: "Editor", icon: <Wrench size={15} /> },
  { id: "profile", label: "Perfil", icon: <UserRound size={15} /> },
];

export function SaasDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DashboardTab>("editor");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [projects, setProjects] = useState<CadProject[]>([]);
  const [activeProject, setActiveProject] = useState<CadProject | null>(null);
  const [status, setStatus] = useState("Conectando ao Supabase...");
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

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
    setStatus(data?.length ? "Projetos carregados. Editor pronto para uso." : "Editor pronto. Crie um projeto para salvar seu workspace.");
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
    setActiveTab("editor");
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
    setActiveTab("editor");
    setStatus(`Projeto criado: ${(data as CadProject).name}`);
  }, [projects.length, user]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    client.auth.getUser().then(({ data }) => {
      setUser(data.user);
      const name = metadataName(data.user);
      setProfileFirstName(name.firstName);
      setProfileLastName(name.lastName);
      setAuthLoading(false);
      if (data.user) loadProjects(data.user.id);
      else router.replace("/login");
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      const name = metadataName(session?.user || null);
      setProfileFirstName(name.firstName);
      setProfileLastName(name.lastName);
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

  const profileFullName = [profileFirstName, profileLastName].map((part) => part.trim()).filter(Boolean).join(" ");

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;

    setProfileSaving(true);
    setProfileMessage("");

    const { data, error } = await supabase.auth.updateUser({
      data: {
        first_name: profileFirstName.trim(),
        last_name: profileLastName.trim(),
      },
    });

    setProfileSaving(false);
    if (error) {
      setProfileMessage(`Nao foi possivel salvar perfil: ${error.message}`);
      return;
    }

    setUser(data.user);
    setProfileMessage("Perfil atualizado com sucesso.");
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

  return <main className="min-h-screen bg-[#080c0b] text-[#e8efeb]">
    <header className={`sticky top-0 z-40 border-b border-[#26312c] bg-[#080c0b]/95 backdrop-blur transition-all duration-200 ${headerCollapsed ? "shadow-lg shadow-black/20" : ""}`}>
      <div className={`grid gap-3 px-3 transition-all duration-200 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:px-5 ${headerCollapsed ? "min-h-12 grid-cols-[auto_1fr_auto] py-1.5" : "grid-cols-1 py-4"}`}>
        <div className={headerCollapsed ? "min-w-0 lg:justify-self-start" : "lg:justify-self-start"}>
          <div className="flex items-center gap-3">
            <div className={`grid place-items-center rounded-xl bg-[#b7f34a] text-[#09120d] transition-all ${headerCollapsed ? "h-8 w-8" : "h-10 w-10"}`}><FolderOpen size={headerCollapsed ? 15 : 19} /></div>
            <div className={headerCollapsed ? "hidden min-w-0 sm:block" : ""}>
              <h1 className={`${headerCollapsed ? "text-[11px]" : "text-sm"} font-black uppercase tracking-[.18em]`}>VectorCAD SaaS</h1>
              {!headerCollapsed && <p className="mt-1 text-xs text-[#84938b]">{activeProject?.name || "Workspace sem projeto ativo"}</p>}
            </div>
          </div>
        </div>

        <nav className={`flex rounded-2xl border border-[#26312c] bg-[#101613] p-1 transition-all lg:justify-self-center ${headerCollapsed ? "w-full sm:w-auto" : "w-full lg:w-auto"}`}>
          {tabs.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl text-xs font-black transition lg:flex-none ${headerCollapsed ? "px-2.5 py-1.5 sm:px-3" : "px-4 py-2"} ${activeTab === tab.id ? "bg-[#b7f34a] text-[#09120d]" : "text-[#95a49c] hover:bg-[#18221d] hover:text-white"}`}>
            {tab.icon}
            <span className={headerCollapsed ? "hidden sm:inline" : ""}>{tab.label}</span>
          </button>)}
        </nav>

        <div className="flex items-center justify-end gap-2 lg:justify-self-end">
          {!headerCollapsed && <div className="hidden items-center gap-2 text-xs text-[#b7f34a] xl:flex">
            <ShieldCheck size={14} />
            sessao protegida
          </div>}
          <button
            type="button"
            onClick={() => setHeaderCollapsed((value) => !value)}
            aria-label={headerCollapsed ? "Expandir header" : "Recolher header"}
            title={headerCollapsed ? "Expandir header" : "Recolher header"}
            className="grid h-8 w-8 place-items-center rounded-lg border border-[#34413b] text-[#b7f34a] transition hover:border-[#b7f34a] hover:bg-[#162219]"
          >
            {headerCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>
      <div className={`flex flex-wrap items-center gap-2 overflow-hidden border-t border-[#1a241f] px-4 text-xs text-[#8c9a93] transition-all duration-200 lg:px-6 ${headerCollapsed ? "max-h-0 py-0 opacity-0" : "max-h-16 py-2 opacity-100"}`}>
        <span className="rounded-full bg-[#111915] px-3 py-1 text-[#b7f34a]">{sortedProjects.length} projetos</span>
        <span className="min-w-0 flex-1 truncate">{status}</span>
        <span className="hidden text-[#6f7f76] md:inline">{profileFullName || user.email}</span>
      </div>
    </header>

    {activeTab === "projects" && <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-[#26312c] bg-[#101613] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-[-.03em]">Projetos</h2>
          <p className="mt-1 text-sm text-[#8c9a93]">Crie, abra e organize seus trabalhos CAD salvos no Supabase.</p>
        </div>
        <button onClick={createProject} className="flex items-center justify-center gap-2 rounded-xl bg-[#b7f34a] px-5 py-3 text-xs font-black text-[#09120d]"><FilePlus2 size={15} /> Novo Projeto</button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sortedProjects.map((project) => <button key={project.id} onClick={() => openProject(project.id)} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b7f34a] ${activeProject?.id === project.id ? "border-[#b7f34a] bg-[#182318]" : "border-[#26312c] bg-[#101613]"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black">{project.name}</div>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-[#819087]"><Clock3 size={11} /> {new Date(project.updated_at).toLocaleString("pt-BR")}</div>
            </div>
            <span className="rounded-full border border-[#34413b] px-2 py-1 text-[10px] uppercase text-[#9aaaa2]">{project.type}</span>
          </div>
          <p className="mt-4 text-xs text-[#8c9a93]">Abrir no editor</p>
        </button>)}
      </div>

      {!sortedProjects.length && <div className="rounded-3xl border border-dashed border-[#34413b] bg-[#101613] p-10 text-center">
        <FolderOpen className="mx-auto text-[#b7f34a]" />
        <h3 className="mt-4 text-lg font-black">Nenhum projeto salvo ainda</h3>
        <p className="mt-2 text-sm text-[#8c9a93]">O editor ja esta liberado. Crie um projeto para organizar seus arquivos.</p>
      </div>}
    </section>}

    {activeTab === "editor" && <section className={`editor-tab ${headerCollapsed ? "min-h-[calc(100vh-49px)]" : "min-h-[calc(100vh-121px)]"}`}>
      <VectorCadApp />
    </section>}

    {activeTab === "profile" && <section className="mx-auto max-w-4xl px-4 py-8">
      <div className="grid gap-4 md:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-3xl border border-[#26312c] bg-[#101613] p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#b7f34a] text-[#09120d]"><UserRound size={22} /></div>
            <div>
              <h2 className="text-xl font-black">{profileFullName || "Perfil"}</h2>
              <p className="text-sm text-[#8c9a93]">{user.email}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 text-sm">
            <form onSubmit={saveProfile} className="rounded-2xl border border-[#26312c] bg-[#0b100e] p-4">
              <div className="text-xs uppercase tracking-[.14em] text-[#728178]">Dados pessoais</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-[#aab8b1]">Nome<input value={profileFirstName} onChange={(event) => setProfileFirstName(event.target.value)} className="mt-1 w-full" type="text" /></label>
                <label className="text-xs text-[#aab8b1]">Sobrenome<input value={profileLastName} onChange={(event) => setProfileLastName(event.target.value)} className="mt-1 w-full" type="text" /></label>
              </div>
              <button disabled={profileSaving} className="mt-4 rounded-xl bg-[#b7f34a] px-4 py-2 text-xs font-black text-[#09120d] disabled:opacity-60">{profileSaving ? "Salvando..." : "Salvar perfil"}</button>
              {profileMessage && <p className="mt-3 text-xs text-[#8c9a93]">{profileMessage}</p>}
            </form>
            <div className="rounded-2xl border border-[#26312c] bg-[#0b100e] p-4">
              <div className="text-xs uppercase tracking-[.14em] text-[#728178]">User ID</div>
              <div className="mt-2 break-all text-xs text-[#dbe5df]">{user.id}</div>
            </div>
            <div className="rounded-2xl border border-[#26312c] bg-[#0b100e] p-4">
              <div className="text-xs uppercase tracking-[.14em] text-[#728178]">Projetos vinculados</div>
              <div className="mt-2 text-2xl font-black text-[#b7f34a]">{sortedProjects.length}</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-[#26312c] bg-[#101613] p-6">
          <div className="flex items-center gap-2 text-sm font-black"><Settings size={16} /> Configuracoes futuras</div>
          <p className="mt-3 text-sm leading-6 text-[#8c9a93]">Este espaco fica reservado para preferencias, assinatura, billing e configuracoes de exportacao.</p>
          <button onClick={signOut} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[#34413b] py-3 text-xs font-black text-[#d6e0da] hover:border-[#b7f34a] hover:text-[#b7f34a]"><LogOut size={15} /> Sair da conta</button>
        </div>
      </div>
    </section>}
  </main>;
}

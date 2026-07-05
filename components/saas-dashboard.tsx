"use client";

import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Check, ChevronDown, ChevronUp, Clock3, Copy, Crown, Eye, EyeOff, FilePlus2, FolderOpen, LogOut, Settings, ShieldCheck, Trash2, UserRound, Wrench } from "lucide-react";
import { normalizeCompany, normalizeCompanyPlan, resolveEffectivePlan, shouldShowAds, userHasPremiumAccess, type CompanyPlan } from "@/lib/access-control";
import { getBillingPlan } from "@/lib/billing";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { AdSenseSlot } from "@/components/adsense-slot";
import { UsageMeter } from "@/components/usage-meter";
import { VectorCadApp } from "@/components/vector-cad-app";
import type { CadProject, CadProjectData } from "@/types/project";

type DashboardTab = "projects" | "editor" | "profile";

type UserProfile = {
  user_id: string;
  name: string | null;
  surname: string | null;
  company: string | null;
  plan: CompanyPlan;
  is_premium: boolean;
  payment_status: string | null;
  usage_count_today?: number | null;
  export3d_count_today?: number | null;
  last_usage_reset?: string | null;
};

type UsageSnapshot = {
  plan: string;
  usage: number;
  usageLimit: number | null;
  export3d: number;
  export3dLimit: number | null;
  adsVisible: boolean;
};

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
const dashboardAdSlot = process.env.NEXT_PUBLIC_ADSENSE_DASHBOARD_SLOT;
const projectsAdSlot = process.env.NEXT_PUBLIC_ADSENSE_PROJECTS_SLOT || dashboardAdSlot;
const editorAdSlot = process.env.NEXT_PUBLIC_ADSENSE_EDITOR_SLOT || dashboardAdSlot;

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
  const [profileCompany, setProfileCompany] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [showUserId, setShowUserId] = useState(false);
  const [userIdCopied, setUserIdCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CadProject | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  const canUseSupabase = isSupabaseConfigured && supabase;
  const premiumAccess = userHasPremiumAccess(profile);
  const adsVisible = shouldShowAds(profile);
  const effectivePlan = resolveEffectivePlan(profile);
  const planConfig = getBillingPlan(effectivePlan);
  const planLabel = planConfig.title;

  const applyUsageSnapshot = useCallback((snapshot: UsageSnapshot, owner?: User) => {
    setProfile((current) => {
      const fallbackName = metadataName(owner || null);
      const base = current || (owner ? {
        user_id: owner.id,
        name: fallbackName.firstName || null,
        surname: fallbackName.lastName || null,
        company: normalizeCompany(String(owner.user_metadata?.company || "")),
        plan: normalizeCompanyPlan(String(owner.user_metadata?.plan || "free")),
        is_premium: Boolean(owner.user_metadata?.is_premium),
        payment_status: String(owner.user_metadata?.payment_status || "none"),
        usage_count_today: 0,
        export3d_count_today: 0,
      } : null);

      return base ? {
      ...base,
      plan: normalizeCompanyPlan(snapshot.plan),
      usage_count_today: snapshot.usage,
      export3d_count_today: snapshot.export3d,
      last_usage_reset: new Date().toISOString(),
    } : current;
    });
  }, []);

  const refreshUsage = useCallback(async (owner?: User) => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    const response = await fetch("/api/usage/consume", {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload) applyUsageSnapshot(payload as UsageSnapshot, owner);
  }, [applyUsageSnapshot]);

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

  const loadProfile = useCallback(async (currentUser: User) => {
    if (!supabase) return;
    const fallback = metadataName(currentUser);
    const metadataCompany = normalizeCompany(String(currentUser.user_metadata?.company || ""));

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) {
      setProfile({
        user_id: currentUser.id,
        name: fallback.firstName || null,
        surname: fallback.lastName || null,
        company: metadataCompany,
        plan: normalizeCompanyPlan(String(currentUser.user_metadata?.plan || "free")),
        is_premium: Boolean(currentUser.user_metadata?.is_premium),
        payment_status: String(currentUser.user_metadata?.payment_status || "none"),
        usage_count_today: 0,
        export3d_count_today: 0,
      });
      setProfileCompany(metadataCompany || "");
      return;
    }

    const profileRow = data as Partial<UserProfile> | null;
    if (profileRow) {
      const nextProfile: UserProfile = {
        user_id: currentUser.id,
        name: profileRow.name || fallback.firstName || null,
        surname: profileRow.surname || fallback.lastName || null,
        company: profileRow.company || metadataCompany,
        plan: normalizeCompanyPlan(profileRow.plan || String(currentUser.user_metadata?.plan || "free")),
        is_premium: Boolean(profileRow.is_premium || currentUser.user_metadata?.is_premium),
        payment_status: profileRow.payment_status || String(currentUser.user_metadata?.payment_status || "none"),
        usage_count_today: Number(profileRow.usage_count_today || 0),
        export3d_count_today: Number(profileRow.export3d_count_today || 0),
        last_usage_reset: typeof profileRow.last_usage_reset === "string" ? profileRow.last_usage_reset : null,
      };
      setProfile(nextProfile);
      setProfileFirstName(nextProfile.name || "");
      setProfileLastName(nextProfile.surname || "");
      setProfileCompany(nextProfile.company || "");
      return;
    }

    const createdProfile = {
      user_id: currentUser.id,
      name: fallback.firstName || null,
      surname: fallback.lastName || null,
      company: metadataCompany,
      plan: normalizeCompanyPlan(String(currentUser.user_metadata?.plan || "free")),
      is_premium: Boolean(currentUser.user_metadata?.is_premium),
      payment_status: String(currentUser.user_metadata?.payment_status || "none"),
      usage_count_today: 0,
      export3d_count_today: 0,
    };
    await supabase.from("profiles").upsert(createdProfile, { onConflict: "user_id" });
    setProfile(createdProfile);
    setProfileCompany(metadataCompany || "");
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

  const confirmDeleteProject = useCallback(async () => {
    if (!supabase || !user || !deleteTarget) return;

    const target = deleteTarget;
    const previousProjects = projects;

    setDeletingProjectId(target.id);
    setProjects((current) => current.filter((project) => project.id !== target.id));
    if (activeProject?.id === target.id) setActiveProject(null);
    setDeleteTarget(null);

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", target.id)
      .eq("user_id", user.id);

    setDeletingProjectId(null);

    if (error) {
      setProjects(previousProjects);
      if (activeProject?.id === target.id) setActiveProject(activeProject);
      setStatus(`Nao foi possivel excluir o projeto: ${error.message}`);
      return;
    }

    setStatus("Projeto excluido com sucesso.");
    setToastMessage("Projeto excluido com sucesso");
    window.setTimeout(() => setToastMessage(""), 2600);
  }, [activeProject, deleteTarget, projects, user]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    client.auth.getUser().then(({ data }) => {
      setUser(data.user);
      const name = metadataName(data.user);
      setProfileFirstName(name.firstName);
      setProfileLastName(name.lastName);
      setAuthLoading(false);
      if (data.user) {
        loadProjects(data.user.id);
        loadProfile(data.user);
        refreshUsage(data.user);
      }
      else router.replace("/login");
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      const name = metadataName(session?.user || null);
      setProfileFirstName(name.firstName);
      setProfileLastName(name.lastName);
      setProfile(null);
      setProfileCompany("");
      setActiveProject(null);
      setProjects([]);
      if (session?.user) {
        loadProjects(session.user.id);
        loadProfile(session.user);
        refreshUsage(session.user);
      }
      else router.replace("/login");
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfile, loadProjects, refreshUsage, router]);

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
  const hiddenUserId = "••••••••-••••-••••-••••-••••••••••••";

  const copyUserId = async () => {
    if (!user) return;
    await navigator.clipboard.writeText(user.id);
    setUserIdCopied(true);
    window.setTimeout(() => setUserIdCopied(false), 1600);
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;

    setProfileSaving(true);
    setProfileMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setProfileSaving(false);
      setProfileMessage("Sessao expirada. Faca login novamente.");
      return;
    }

    const response = await fetch("/api/profile/update", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: profileFirstName.trim(),
        last_name: profileLastName.trim(),
      }),
    });
    const payload = await response.json().catch(() => ({}));

    setProfileSaving(false);
    if (!response.ok) {
      setProfileMessage(`Nao foi possivel salvar perfil: ${payload.error || "erro desconhecido"}`);
      return;
    }

    setUser(payload.user);
    const savedProfile = payload.profile || profile;
    const nextProfile = {
      user_id: user?.id || payload.user.id,
      name: profileFirstName.trim() || null,
      surname: profileLastName.trim() || null,
      company: savedProfile?.company || profile?.company || null,
      plan: profile?.plan || normalizeCompanyPlan(String(payload.user.user_metadata?.plan || "free")),
      is_premium: Boolean(profile?.is_premium || payload.user.user_metadata?.is_premium),
      payment_status: profile?.payment_status || String(payload.user.user_metadata?.payment_status || "none"),
      usage_count_today: profile?.usage_count_today || 0,
      export3d_count_today: profile?.export3d_count_today || 0,
      last_usage_reset: profile?.last_usage_reset || null,
    };
    setProfile(nextProfile);
    setProfileCompany(nextProfile.company || "");
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
          {!premiumAccess && <button type="button" onClick={() => router.push("/pricing")} className="hidden rounded-lg border border-[#b7f34a]/50 px-3 py-2 text-xs font-black text-[#b7f34a] transition hover:bg-[#172314] md:inline-flex">Ver planos</button>}
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
        <span className={`rounded-full px-3 py-1 ${premiumAccess ? "bg-[#b7f34a] text-[#09120d]" : "bg-[#111915] text-[#8c9a93]"}`}>Plano {planLabel}</span>
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

      <AdSenseSlot enabled={adsVisible} slot={dashboardAdSlot} label="Publicidade no dashboard" className="mb-6" />

      <div className="mb-6">
        <UsageMeter
          plan={effectivePlan}
          usage={profile?.usage_count_today || 0}
          limit={planConfig.usageLimit}
          onUpgrade={() => router.push("/pricing")}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sortedProjects.map((project, index) => <Fragment key={project.id}>
        <article className={`rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#b7f34a] ${deletingProjectId === project.id ? "scale-[.98] opacity-50" : ""} ${activeProject?.id === project.id ? "border-[#b7f34a] bg-[#182318]" : "border-[#26312c] bg-[#101613]"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black">{project.name}</div>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-[#819087]"><Clock3 size={11} /> {new Date(project.updated_at).toLocaleString("pt-BR")}</div>
            </div>
            <span className="rounded-full border border-[#34413b] px-2 py-1 text-[10px] uppercase text-[#9aaaa2]">{project.type}</span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <button type="button" onClick={() => openProject(project.id)} className="rounded-lg border border-[#34413b] px-3 py-2 text-xs font-black text-[#d6e0da] transition hover:border-[#b7f34a] hover:text-[#b7f34a]">Abrir no editor</button>
            <button type="button" onClick={() => setDeleteTarget(project)} className="flex items-center gap-1 rounded-lg border border-transparent px-3 py-2 text-xs font-black text-[#ff8f8f] transition hover:border-[#6d2e2e] hover:bg-[#2a1111]" aria-label={`Excluir projeto ${project.name}`}><Trash2 size={14} /> Excluir</button>
          </div>
        </article>
        {index === 1 && <AdSenseSlot enabled={adsVisible} slot={projectsAdSlot} label="Publicidade" className="md:col-span-2 xl:col-span-3" />}
        </Fragment>)}
      </div>

      {!sortedProjects.length && <div className="rounded-3xl border border-dashed border-[#34413b] bg-[#101613] p-10 text-center">
        <FolderOpen className="mx-auto text-[#b7f34a]" />
        <h3 className="mt-4 text-lg font-black">Nenhum projeto salvo ainda</h3>
        <p className="mt-2 text-sm text-[#8c9a93]">O editor ja esta liberado. Crie um projeto para organizar seus arquivos.</p>
      </div>}
    </section>}

    {deleteTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[#3a2a2a] bg-[#101613] p-6 shadow-2xl shadow-black/50">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#2a1111] text-[#ff8f8f]"><Trash2 size={22} /></div>
        <h3 className="mt-4 text-xl font-black">Excluir projeto?</h3>
        <p className="mt-2 text-sm leading-6 text-[#9caaa3]">Tem certeza que deseja excluir este projeto? <span className="font-bold text-[#e8efeb]">{deleteTarget.name}</span> sera removido da sua lista.</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl border border-[#34413b] px-4 py-3 text-xs font-black text-[#d6e0da] transition hover:border-[#b7f34a] hover:text-[#b7f34a]">Cancelar</button>
          <button type="button" onClick={confirmDeleteProject} className="rounded-xl bg-[#ff5f5f] px-4 py-3 text-xs font-black text-[#160606] transition hover:brightness-110">Confirmar exclusao</button>
        </div>
      </div>
    </div>}

    {toastMessage && <div className="fixed bottom-5 right-5 z-50 rounded-2xl border border-[#b7f34a]/40 bg-[#101613] px-4 py-3 text-sm font-bold text-[#e8efeb] shadow-2xl shadow-black/40">
      <span className="text-[#b7f34a]">✓</span> {toastMessage}
    </div>}

    {activeTab === "editor" && <section className={`editor-tab ${headerCollapsed ? "min-h-[calc(100vh-49px)]" : "min-h-[calc(100vh-121px)]"}`}>
      <VectorCadApp adsVisible={adsVisible} adSlot={editorAdSlot} onUsageChange={applyUsageSnapshot} />
    </section>}

    {activeTab === "profile" && <section className="mx-auto max-w-4xl px-4 py-8">
      <div className="grid gap-4 md:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-3xl border border-[#26312c] bg-[#101613] p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#b7f34a] text-[#09120d]"><UserRound size={22} /></div>
            <div>
              <h2 className="text-2xl font-bold tracking-[-.03em]">{profileFirstName.trim() || "Perfil"}</h2>
              {profileLastName.trim() && <div className="mt-0.5 text-lg font-semibold text-[#cfd9d3]">{profileLastName.trim()}</div>}
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
              <label className="mt-3 block text-xs text-[#aab8b1]">Empresa
                <input
                  value={profileCompany || "Sem empresa vinculada"}
                  readOnly
                  className="mt-1 w-full cursor-not-allowed opacity-80"
                  type="text"
                  title="Campo informativo. Apenas o administrador pode vincular empresas e planos."
                />
              </label>
              <p className="mt-2 text-[11px] leading-5 text-[#7c8b83]">Empresa e plano sao controlados pelo pagamento ou pela area admin. Alterar dados pessoais nao muda seu plano.</p>
              <button disabled={profileSaving} className="mt-4 rounded-xl bg-[#b7f34a] px-4 py-2 text-xs font-black text-[#09120d] disabled:opacity-60">{profileSaving ? "Salvando..." : "Salvar perfil"}</button>
              {profileMessage && <p className="mt-3 text-xs text-[#8c9a93]">{profileMessage}</p>}
            </form>
            <div className={`rounded-2xl border p-4 ${premiumAccess ? "border-[#b7f34a]/60 bg-[#172314]" : "border-[#26312c] bg-[#0b100e]"}`}>
              <div className="text-xs uppercase tracking-[.14em] text-[#728178]">Controle de acesso</div>
              <div className="mt-2 flex items-center gap-2 text-lg font-black"><Crown size={17} className={premiumAccess ? "text-[#b7f34a]" : "text-[#6f7f76]"} /> Plano {planLabel}</div>
              <p className="mt-2 text-xs leading-5 text-[#8c9a93]">{premiumAccess ? "Acesso premium ativo: anuncios ocultos, DXF e recursos PRO liberados." : adsVisible ? "Conta com anuncios e limites diarios conforme o plano." : "Anuncios ocultos para esta conta."}</p>
              <div className="mt-3 grid gap-2 text-xs text-[#8c9a93]">
                <div>Uso hoje: <b className="text-[#e8efeb]">{profile?.usage_count_today || 0}</b>{planConfig.usageLimit === null ? " / ilimitado" : ` / ${planConfig.usageLimit}`}</div>
                <div>3D hoje: <b className="text-[#e8efeb]">{profile?.export3d_count_today || 0}</b>{planConfig.export3dLimit === null ? " / ilimitado" : ` / ${planConfig.export3dLimit}`}</div>
              </div>
              {!premiumAccess && <button type="button" onClick={() => router.push("/pricing")} className="mt-4 w-full rounded-xl bg-[#b7f34a] px-4 py-3 text-xs font-black text-[#09120d] transition hover:brightness-105">Ver planos</button>}
              {profile?.payment_status && <div className="mt-3 text-[10px] uppercase tracking-[.14em] text-[#728178]">Pagamento: {profile.payment_status}</div>}
            </div>
            <UsageMeter
              plan={effectivePlan}
              usage={profile?.usage_count_today || 0}
              limit={planConfig.usageLimit}
              onUpgrade={() => router.push("/pricing")}
            />
            <div className="rounded-2xl border border-[#26312c] bg-[#0b100e] p-4">
              <div className="text-xs uppercase tracking-[.14em] text-[#728178]">User ID</div>
              <div className="relative mt-3 w-full">
                <input readOnly value={showUserId ? user.id : hiddenUserId} className="w-full rounded-xl border border-[#34423c] bg-[#080c0b] px-4 py-3 pr-24 font-mono text-xs text-[#dbe5df] outline-none" />
                <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
                  <button type="button" onClick={() => setShowUserId((value) => !value)} aria-label={showUserId ? "Ocultar User ID" : "Mostrar User ID"} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8d9a93] transition hover:bg-[#17221c] hover:text-[#b7f34a]">
                    {showUserId ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button type="button" onClick={copyUserId} aria-label="Copiar User ID" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8d9a93] transition hover:bg-[#17221c] hover:text-[#b7f34a]">
                    {userIdCopied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
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

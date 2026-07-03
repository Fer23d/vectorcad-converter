"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, ChevronDown, ChevronUp, Clock3, FolderOpen, ShieldAlert, ShieldCheck, Trash2, UserPlus, UsersRound, XCircle } from "lucide-react";
import { isAdminUser } from "@/lib/admin";
import { isPremiumCompany } from "@/lib/access-control";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

type AdminOverview = {
  stats: {
    totalUsers: number;
    totalProjects: number;
    activeUsers: number;
    smaUsers: number;
  };
  companyCounts: Record<string, { total: number; premium: number }>;
  smAUsers: AdminUser[];
  usersWithoutCompany: AdminUser[];
  latestLogins: {
    id: string;
    email: string;
    company: string | null;
    premium: boolean;
    created_at: string;
    last_sign_in_at: string | null;
  }[];
  users: AdminUser[];
  projects: {
    id: string;
    name: string;
    user_id: string;
    company: string | null;
    type: string;
    created_at: string;
    updated_at: string;
  }[];
};

type AdminUser = {
  id: string;
  email: string;
  company: string | null;
  premium: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

type CollapsedSections = {
  sma: boolean;
  noCompany: boolean;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function formatOptionalDate(value: string | null) {
  return value ? formatDate(value) : "Nunca";
}

export function AdminDashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [message, setMessage] = useState("Validando acesso admin...");
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [adminToken, setAdminToken] = useState("");
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<CollapsedSections>(() => {
    if (typeof window === "undefined") return { sma: false, noCompany: false };
    const savedCollapse = window.localStorage.getItem("vectorcad-admin-collapse");
    if (!savedCollapse) return { sma: false, noCompany: false };
    try {
      return { sma: false, noCompany: false, ...JSON.parse(savedCollapse) };
    } catch {
      return { sma: false, noCompany: false };
    }
  });
  const [companyModalUser, setCompanyModalUser] = useState<AdminUser | null>(null);
  const [companyInput, setCompanyInput] = useState("SM&A");
  const [companySavingUserId, setCompanySavingUserId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      router.replace("/login");
      return;
    }

    client.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      if (!isAdminUser(session.user.id)) {
        router.replace("/editor");
        return;
      }

      setAdminToken(session.access_token);
      const response = await fetch("/api/admin/overview", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          router.replace("/editor");
          return;
        }

        setMessage(payload.error || "Nao foi possivel carregar o painel admin.");
        setLoading(false);
        return;
      }

      setOverview(payload as AdminOverview);
      setMessage("Painel admin carregado.");
      setLoading(false);
    });
  }, [router]);

  const showToast = (text: string) => {
    setToastMessage(text);
    window.setTimeout(() => setToastMessage(""), 2600);
  };

  const setSectionCollapsed = (section: "sma" | "noCompany", collapsed: boolean) => {
    setCollapsedSections((current) => {
      const next = { ...current, [section]: collapsed };
      window.localStorage.setItem("vectorcad-admin-collapse", JSON.stringify(next));
      return next;
    });
  };

  const rebuildOverviewUsers = (current: AdminOverview, nextUsers: AdminUser[]): AdminOverview => {
    const companyCounts = nextUsers.reduce<Record<string, { total: number; premium: number }>>((totals, user) => {
      const company = user.company || "Sem empresa";
      totals[company] ||= { total: 0, premium: 0 };
      totals[company].total += 1;
      if (user.premium) totals[company].premium += 1;
      return totals;
    }, {});
    const companyByUserId = new Map(nextUsers.map((user) => [user.id, user.company]));

    return {
      ...current,
      stats: {
        ...current.stats,
        smaUsers: nextUsers.filter((user) => isPremiumCompany(user.company)).length,
      },
      companyCounts,
      users: nextUsers,
      smAUsers: nextUsers.filter((user) => isPremiumCompany(user.company)),
      usersWithoutCompany: nextUsers.filter((user) => !user.company),
      latestLogins: current.latestLogins.map((login) => nextUsers.find((user) => user.id === login.id) || login),
      projects: current.projects.map((project) => ({ ...project, company: companyByUserId.get(project.user_id) || null })),
    };
  };

  const updateUserCompany = async (targetUser: AdminUser, company: string | null) => {
    if (!adminToken || !overview) return;
    const previousOverview = overview;
    const normalizedCompany = company?.trim() || null;
    const nextUsers = overview.users.map((user) => user.id === targetUser.id ? { ...user, company: normalizedCompany, premium: isPremiumCompany(normalizedCompany) } : user);

    setCompanySavingUserId(targetUser.id);
    setOverview(rebuildOverviewUsers(overview, nextUsers));
    setCompanyModalUser(null);

    const response = await fetch(`/api/admin/users/${targetUser.id}/company`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ company: normalizedCompany }),
    });

    setCompanySavingUserId(null);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setOverview(previousOverview);
      setMessage(payload.error || "Nao foi possivel atualizar empresa do usuario.");
      return;
    }

    showToast(normalizedCompany ? `Usuario movido para ${normalizedCompany}.` : "Usuario removido da empresa.");
    setMessage("Empresa do usuario atualizada.");
  };

  const deleteAdminProject = async (projectId: string, projectName: string) => {
    if (!adminToken || !overview) return;
    if (!window.confirm(`Tem certeza que deseja excluir o projeto "${projectName}"?`)) return;

    const previousOverview = overview;
    setDeletingProjectId(projectId);
    setOverview({
      ...overview,
      stats: { ...overview.stats, totalProjects: Math.max(0, overview.stats.totalProjects - 1) },
      projects: overview.projects.filter((project) => project.id !== projectId),
    });

    const response = await fetch(`/api/admin/projects/${projectId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    setDeletingProjectId(null);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setOverview(previousOverview);
      setMessage(payload.error || "Nao foi possivel excluir o projeto.");
      return;
    }

    setMessage("Projeto excluido com sucesso.");
    showToast("Projeto excluido com sucesso.");
  };

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[#080c0b] text-[#e8efeb]">
      <div className="text-xs uppercase tracking-[.18em] text-[#b7f34a]">{message}</div>
    </main>;
  }

  if (!overview) {
    return <main className="grid min-h-screen place-items-center bg-[#080c0b] p-6 text-[#e8efeb]">
      <div className="max-w-xl rounded-3xl border border-[#33413a] bg-[#101613] p-6 text-center">
        <ShieldAlert className="mx-auto text-[#b7f34a]" />
        <h1 className="mt-4 text-xl font-black">Admin indisponivel</h1>
        <p className="mt-2 text-sm leading-6 text-[#9caaa3]">{message}</p>
      </div>
    </main>;
  }

  const companies = Object.keys(overview.companyCounts).sort((a, b) => a.localeCompare(b));
  const filteredUsers = overview.users.filter((user) => companyFilter === "all" || (user.company || "Sem empresa") === companyFilter);
  const filteredProjects = overview.projects.filter((project) => companyFilter === "all" || (project.company || "Sem empresa") === companyFilter);
  const premiumByCompany = companies.filter((company) => overview.companyCounts[company]?.premium > 0);

  return <main className="min-h-screen bg-[#080c0b] text-[#e8efeb]">
    <header className="border-b border-[#26312c] bg-[#0d1210] px-5 py-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#b7f34a] text-[#09120d]"><ShieldCheck size={22} /></div>
            <div>
              <h1 className="text-xl font-black tracking-[-.03em]">Admin VectorCAD</h1>
              <p className="text-sm text-[#8c9a93]">Painel global do sistema</p>
            </div>
          </div>
        </div>
        <button onClick={() => router.push("/dashboard")} className="rounded-xl border border-[#34413b] px-4 py-2 text-xs font-black text-[#d6e0da] hover:border-[#b7f34a] hover:text-[#b7f34a]">Voltar ao dashboard</button>
      </div>
    </header>

    <section className="mx-auto max-w-7xl px-5 py-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<UsersRound size={20} />} label="Total de usuarios" value={overview.stats.totalUsers} />
        <StatCard icon={<FolderOpen size={20} />} label="Total de projetos" value={overview.stats.totalProjects} />
        <StatCard icon={<Activity size={20} />} label="Usuarios ativos" value={overview.stats.activeUsers} />
        <StatCard icon={<ShieldCheck size={20} />} label="Usuarios SM&A" value={overview.stats.smaUsers} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-[#26312c] bg-[#101613] p-5 xl:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[.14em]">Filtro por empresa</h2>
              <p className="mt-1 text-xs text-[#7c8b83]">Filtra usuarios e projetos por tenant/company.</p>
            </div>
            <label className="text-xs font-bold text-[#aab8b1]">Empresa
              <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} className="mt-1 min-w-56 rounded-xl border border-[#34423c] bg-[#0b100e] px-4 py-3 text-sm text-[#eef5f1] outline-none focus:border-[#b7f34a]">
                <option value="all">Todas as empresas</option>
                {companies.map((company) => <option key={company} value={company}>{company}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {companies.map((company) => <div key={company} className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4">
              <div className="truncate text-sm font-black text-[#e8efeb]">{company}</div>
              <div className="mt-2 text-xs text-[#8c9a93]">{overview.companyCounts[company].total} usuarios</div>
              <div className="mt-1 text-xs text-[#b7f34a]">{overview.companyCounts[company].premium} premium</div>
            </div>)}
          </div>
        </section>

        <section className="rounded-3xl border border-[#26312c] bg-[#101613] p-5 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[.14em]">Ultimos logins</h2>
              <p className="mt-1 text-xs text-[#7c8b83]">Usuarios com acesso recente ao SaaS</p>
            </div>
            <Clock3 className="text-[#b7f34a]" size={20} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {overview.latestLogins.length ? overview.latestLogins.map((user) => <div key={user.id} className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4">
              <div className="truncate text-sm font-black text-[#e8efeb]">{user.email}</div>
              <div className="mt-2 text-xs text-[#8c9a93]">{formatOptionalDate(user.last_sign_in_at)}</div>
            </div>) : <div className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4 text-sm text-[#8c9a93]">Nenhum login registrado ainda.</div>}
          </div>
        </section>

        <CollapsibleSection
          title="Usuarios SM&A"
          collapsed={collapsedSections.sma}
          onToggle={() => setSectionCollapsed("sma", !collapsedSections.sma)}
          accent
        >
          <UserList
            users={overview.smAUsers}
            empty="Nenhum usuario SM&A ainda."
            actionLabel="Remover da empresa"
            actionIcon={<XCircle size={13} />}
            actionTone="danger"
            loadingUserId={companySavingUserId}
            onAction={(user) => updateUserCompany(user, null)}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Usuarios sem empresa"
          collapsed={collapsedSections.noCompany}
          onToggle={() => setSectionCollapsed("noCompany", !collapsedSections.noCompany)}
        >
          <UserList
            users={overview.usersWithoutCompany}
            empty="Todos os usuarios possuem empresa."
            actionLabel="Adicionar a empresa"
            actionIcon={<UserPlus size={13} />}
            loadingUserId={companySavingUserId}
            onAction={(user) => {
              setCompanyInput("SM&A");
              setCompanyModalUser(user);
            }}
          />
        </CollapsibleSection>

        <section className="rounded-3xl border border-[#26312c] bg-[#101613] p-5 xl:col-span-2">
          <h2 className="text-sm font-black uppercase tracking-[.14em]">Premium por empresa</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {premiumByCompany.length ? premiumByCompany.map((company) => <div key={company} className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4">
              <div className="truncate text-sm font-black text-[#e8efeb]">{company}</div>
              <div className="mt-2 text-2xl font-black text-[#b7f34a]">{overview.companyCounts[company].premium}</div>
            </div>) : <div className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4 text-sm text-[#8c9a93]">Nenhuma empresa premium encontrada.</div>}
          </div>
        </section>

        <section className="rounded-3xl border border-[#26312c] bg-[#101613] p-5">
          <h2 className="text-sm font-black uppercase tracking-[.14em]">Usuarios</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="text-[#7c8b83]"><tr><th className="py-2">Email</th><th>Empresa</th><th>ID</th><th>Criado em</th><th>Ultimo login</th></tr></thead>
              <tbody>
                {filteredUsers.map((user) => <tr key={user.id} className="border-t border-[#26312c]">
                  <td className="py-3 font-bold text-[#e8efeb]">{user.email}</td>
                  <td className="text-[#9aa8a1]"><CompanyBadge company={user.company} premium={user.premium} /></td>
                  <td className="max-w-[180px] truncate text-[#9aa8a1]">{user.id}</td>
                  <td className="text-[#9aa8a1]">{formatDate(user.created_at)}</td>
                  <td className="text-[#9aa8a1]">{formatOptionalDate(user.last_sign_in_at)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-[#26312c] bg-[#101613] p-5">
          <h2 className="text-sm font-black uppercase tracking-[.14em]">Projetos</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="text-[#7c8b83]"><tr><th className="py-2">Nome</th><th>Empresa</th><th>User ID</th><th>Criado em</th><th>Acoes</th></tr></thead>
              <tbody>
                {filteredProjects.map((project) => <tr key={project.id} className="border-t border-[#26312c]">
                  <td className="py-3 font-bold text-[#e8efeb]">{project.name}</td>
                  <td className="text-[#9aa8a1]"><CompanyBadge company={project.company} /></td>
                  <td className="max-w-[180px] truncate text-[#9aa8a1]">{project.user_id}</td>
                  <td className="text-[#9aa8a1]">{formatDate(project.created_at)}</td>
                  <td>
                    <button
                      type="button"
                      disabled={deletingProjectId === project.id}
                      onClick={() => deleteAdminProject(project.id, project.name)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black text-[#ff8f8f] transition hover:bg-[#2a1111] disabled:opacity-50"
                    >
                      <Trash2 size={12} /> Excluir
                    </button>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>

    {companyModalUser && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[#33413a] bg-[#101613] p-6 shadow-2xl shadow-black/50">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#b7f34a] text-[#09120d]"><UserPlus size={22} /></div>
        <h3 className="mt-4 text-xl font-black">Adicionar a empresa</h3>
        <p className="mt-2 text-sm leading-6 text-[#9caaa3]">Selecione a empresa para vincular <span className="font-bold text-[#e8efeb]">{companyModalUser.email}</span>.</p>
        <label className="mt-4 block text-xs font-bold text-[#aab8b1]">Empresa
          <select value={companyInput} onChange={(event) => setCompanyInput(event.target.value)} className="mt-2 w-full rounded-xl border border-[#34423c] bg-[#0b100e] px-4 py-3 text-sm text-[#eef5f1] outline-none focus:border-[#b7f34a]">
            <option value="SM&A">SM&A</option>
            {companies.filter((company) => company !== "Sem empresa" && company !== "SM&A").map((company) => <option key={company} value={company}>{company}</option>)}
          </select>
        </label>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setCompanyModalUser(null)} className="rounded-xl border border-[#34413b] px-4 py-3 text-xs font-black text-[#d6e0da] transition hover:border-[#b7f34a] hover:text-[#b7f34a]">Cancelar</button>
          <button type="button" onClick={() => updateUserCompany(companyModalUser, companyInput)} className="rounded-xl bg-[#b7f34a] px-4 py-3 text-xs font-black text-[#09120d] transition hover:brightness-105">Confirmar</button>
        </div>
      </div>
    </div>}

    {toastMessage && <div className="fixed bottom-5 right-5 z-50 rounded-2xl border border-[#b7f34a]/40 bg-[#101613] px-4 py-3 text-sm font-bold text-[#e8efeb] shadow-2xl shadow-black/40">
      <span className="text-[#b7f34a]">✓</span> {toastMessage}
    </div>}
  </main>;
}

function CompanyBadge({ company, premium }: { company: string | null; premium?: boolean }) {
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase ${premium ? "bg-[#b7f34a] text-[#09120d]" : "bg-[#111915] text-[#8c9a93]"}`}>{company || "Sem empresa"}</span>;
}

function CollapsibleSection({ title, collapsed, onToggle, children, accent = false }: { title: string; collapsed: boolean; onToggle: () => void; children: React.ReactNode; accent?: boolean }) {
  return <section className={`rounded-3xl border bg-[#101613] p-5 ${accent ? "border-[#b7f34a]/40" : "border-[#26312c]"}`}>
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left">
      <h2 className="text-sm font-black uppercase tracking-[.14em]">{title}</h2>
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-[#34413b] text-[#b7f34a]">{collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</span>
    </button>
    <div className={`grid transition-all duration-300 ${collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
      <div className="overflow-hidden">{children}</div>
    </div>
  </section>;
}

function UserList({ users, empty, actionLabel, actionIcon, actionTone = "default", loadingUserId, onAction }: { users: AdminUser[]; empty: string; actionLabel?: string; actionIcon?: React.ReactNode; actionTone?: "default" | "danger"; loadingUserId?: string | null; onAction?: (user: AdminUser) => void }) {
  return <div className="mt-4 grid gap-2">
    {users.length ? users.map((user) => <div key={user.id} className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4">
      <div className="truncate text-sm font-black text-[#e8efeb]">{user.email}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#8c9a93]"><CompanyBadge company={user.company} premium={user.premium} /> {formatOptionalDate(user.last_sign_in_at)}</div>
      {actionLabel && onAction && <button
        type="button"
        disabled={loadingUserId === user.id}
        onClick={() => onAction(user)}
        className={`mt-3 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[10px] font-black transition disabled:opacity-50 ${actionTone === "danger" ? "text-[#ff8f8f] hover:bg-[#2a1111]" : "text-[#b7f34a] hover:bg-[#172314]"}`}
      >
        {actionIcon} {loadingUserId === user.id ? "Salvando..." : actionLabel}
      </button>}
    </div>) : <div className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4 text-sm text-[#8c9a93]">{empty}</div>}
  </div>;
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <div className="rounded-3xl border border-[#26312c] bg-[#101613] p-5">
    <div className="flex items-center justify-between">
      <div className="text-[#b7f34a]">{icon}</div>
      <span className="rounded-full bg-[#111915] px-2 py-1 text-[10px] uppercase text-[#8c9a93]">admin</span>
    </div>
    <div className="mt-5 text-3xl font-black">{value}</div>
    <div className="mt-1 text-xs uppercase tracking-[.14em] text-[#7c8b83]">{label}</div>
  </div>;
}

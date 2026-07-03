"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, Building2, ChevronDown, ChevronUp, Clock3, CreditCard, FolderOpen, PlusCircle, ScrollText, ShieldAlert, ShieldCheck, Trash2, UserPlus, UsersRound, XCircle } from "lucide-react";
import { isAdminUser } from "@/lib/admin";
import { COMPANY_PLANS, type CompanyPlan, isPremiumCompany, normalizeCompanyPlan, planHasPremiumAccess } from "@/lib/access-control";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

type AdminOverview = {
  stats: {
    totalUsers: number;
    totalProjects: number;
    activeUsers: number;
    smaUsers: number;
  };
  companyCounts: Record<string, { total: number; premium: number }>;
  companies: AdminCompany[];
  adminLogs: AdminLog[];
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

type AdminCompany = {
  id: string;
  name: string;
  plan: CompanyPlan;
  user_count: number;
  premium_users: number;
  created_at: string | null;
  updated_at: string | null;
};

type AdminLog = {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
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
  const [deleteCompanyTarget, setDeleteCompanyTarget] = useState<AdminCompany | null>(null);
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);
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
  const [removeCompanyUser, setRemoveCompanyUser] = useState<AdminUser | null>(null);
  const [companyInput, setCompanyInput] = useState("SM&A");
  const [companySavingUserId, setCompanySavingUserId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyPlan, setNewCompanyPlan] = useState<CompanyPlan>("free");
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingPlanCompanyId, setSavingPlanCompanyId] = useState<string | null>(null);

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

  const rebuildOverviewUsers = (current: AdminOverview, nextUsers: AdminUser[], nextCompanies = current.companies): AdminOverview => {
    const planByCompany = new Map(nextCompanies.map((company) => [company.name, company.plan]));
    const companyCounts = nextUsers.reduce<Record<string, { total: number; premium: number }>>((totals, user) => {
      const company = user.company || "Sem empresa";
      const premium = user.premium || planHasPremiumAccess(planByCompany.get(company));
      totals[company] ||= { total: 0, premium: 0 };
      totals[company].total += 1;
      if (premium) totals[company].premium += 1;
      return totals;
    }, {});
    const companyByUserId = new Map(nextUsers.map((user) => [user.id, user.company]));
    const companies = nextCompanies.map((company) => ({
      ...company,
      user_count: companyCounts[company.name]?.total || 0,
      premium_users: companyCounts[company.name]?.premium || 0,
    }));

    return {
      ...current,
      stats: {
        ...current.stats,
        smaUsers: nextUsers.filter((user) => isPremiumCompany(user.company)).length,
      },
      companies,
      companyCounts,
      users: nextUsers,
      smAUsers: nextUsers.filter((user) => isPremiumCompany(user.company)),
      usersWithoutCompany: nextUsers.filter((user) => !user.company),
      latestLogins: current.latestLogins.map((login) => nextUsers.find((user) => user.id === login.id) || login),
      projects: current.projects.map((project) => ({ ...project, company: companyByUserId.get(project.user_id) || null })),
    };
  };

  const updateUserCompany = async (targetUser: AdminUser, company: string | null) => {
    if (!adminToken || !overview) return false;
    const previousOverview = overview;
    const normalizedCompany = company?.trim() || null;
    const selectedPlan = overview.companies.find((item) => item.name === normalizedCompany)?.plan;
    const nextUsers = overview.users.map((user) => user.id === targetUser.id ? { ...user, company: normalizedCompany, premium: isPremiumCompany(normalizedCompany) || planHasPremiumAccess(selectedPlan) } : user);

    setCompanySavingUserId(targetUser.id);
    setOverview(rebuildOverviewUsers(overview, nextUsers));
    setCompanyModalUser(null);

    try {
      const response = await fetch(`/api/admin/users/${targetUser.id}/company`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ company: normalizedCompany }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setOverview(previousOverview);
        setMessage(payload.error || "Nao foi possivel atualizar empresa do usuario.");
        showToast(payload.error || "Nao foi possivel atualizar empresa do usuario.");
        return false;
      }

      showToast(normalizedCompany ? `Usuario movido para ${normalizedCompany}.` : "Usuario removido da empresa.");
      setMessage(normalizedCompany ? "Empresa do usuario atualizada." : "Usuario removido da empresa.");
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? `Nao foi possivel atualizar empresa do usuario: ${error.message}` : "Nao foi possivel atualizar empresa do usuario.";
      setOverview(previousOverview);
      setMessage(errorMessage);
      showToast(errorMessage);
      return false;
    } finally {
      setCompanySavingUserId(null);
    }
  };

  const confirmRemoveUserCompany = async () => {
    if (!removeCompanyUser) return;
    const removed = await updateUserCompany(removeCompanyUser, null);
    if (removed) setRemoveCompanyUser(null);
  };

  const createCompany = async () => {
    if (!adminToken || !overview) return;
    const name = newCompanyName.trim();
    if (!name) {
      setMessage("Informe o nome da empresa.");
      showToast("Informe o nome da empresa.");
      return;
    }

    setSavingCompany(true);
    try {
      const response = await fetch("/api/admin/companies", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, plan: newCompanyPlan }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        const errorMessage = payload.error || "Nao foi possivel criar a empresa.";
        setMessage(errorMessage);
        showToast(errorMessage);
        return;
      }

      const company = (payload.company || payload) as AdminCompany;
      if (!company.id || !company.name) {
        const errorMessage = "A API respondeu sem os dados da empresa criada.";
        setMessage(errorMessage);
        showToast(errorMessage);
        return;
      }

      setOverview({
        ...overview,
        companies: [company, ...overview.companies.filter((item) => item.name !== company.name)],
        companyCounts: { ...overview.companyCounts, [company.name]: overview.companyCounts[company.name] || { total: 0, premium: 0 } },
        adminLogs: [{
          id: crypto.randomUUID(),
          admin_id: "local",
          action: "company.create",
          target_type: "company",
          target_id: company.id,
          metadata: { name: company.name, plan: company.plan },
          created_at: new Date().toISOString(),
        }, ...overview.adminLogs],
      });
      setCreateCompanyOpen(false);
      setNewCompanyName("");
      setNewCompanyPlan("free");
      setMessage("Empresa criada com sucesso.");
      showToast("Empresa criada com sucesso.");
    } catch (error) {
      const errorMessage = error instanceof Error ? `Nao foi possivel criar a empresa: ${error.message}` : "Nao foi possivel criar a empresa.";
      setMessage(errorMessage);
      showToast(errorMessage);
    } finally {
      setSavingCompany(false);
    }
  };

  const updateCompanyPlan = async (company: AdminCompany, plan: CompanyPlan) => {
    if (!adminToken || !overview) return;
    const nextPlan = normalizeCompanyPlan(plan);
    const previousOverview = overview;
    const nextCompanies = overview.companies.map((item) => item.id === company.id ? { ...item, plan: nextPlan, updated_at: new Date().toISOString() } : item);

    setSavingPlanCompanyId(company.id);
    setOverview(rebuildOverviewUsers(overview, overview.users, nextCompanies));

    const response = await fetch(`/api/admin/companies/${encodeURIComponent(company.id)}/plan`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: company.name, plan: nextPlan }),
    });

    setSavingPlanCompanyId(null);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setOverview(previousOverview);
      setMessage(payload.error || "Nao foi possivel atualizar o plano da empresa.");
      return;
    }

    setOverview((current) => current ? {
      ...current,
      companies: current.companies.map((item) => item.id === company.id ? { ...item, ...payload, plan: nextPlan } : item),
      adminLogs: [{
        id: crypto.randomUUID(),
        admin_id: "local",
        action: "company.plan_update",
        target_type: "company",
        target_id: company.id,
        metadata: { name: company.name, plan: nextPlan },
        created_at: new Date().toISOString(),
      }, ...current.adminLogs],
    } : current);
    showToast(`Plano de ${company.name} atualizado.`);
  };

  const deleteCompany = async () => {
    if (!adminToken || !overview || !deleteCompanyTarget) return;
    const target = deleteCompanyTarget;
    const previousOverview = overview;
    const nextUsers = overview.users.map((user) => user.company === target.name || user.company === target.id ? { ...user, company: null, premium: false } : user);
    const nextCompanies = overview.companies.filter((company) => company.id !== target.id);

    setDeletingCompanyId(target.id);
    setDeleteCompanyTarget(null);
    setOverview(rebuildOverviewUsers({
      ...overview,
      adminLogs: [{
        id: crypto.randomUUID(),
        admin_id: "local",
        action: "company.delete",
        target_type: "company",
        target_id: target.id,
        metadata: { name: target.name, plan: target.plan },
        created_at: new Date().toISOString(),
      }, ...overview.adminLogs],
    }, nextUsers, nextCompanies));

    try {
      const response = await fetch(`/api/admin/companies/${encodeURIComponent(target.id)}/plan`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setOverview(previousOverview);
        setMessage(payload.error || "Nao foi possivel remover a empresa.");
        showToast(payload.error || "Nao foi possivel remover a empresa.");
        return;
      }

      setMessage("Empresa removida com sucesso.");
      showToast("Empresa removida com sucesso.");
    } catch (error) {
      const errorMessage = error instanceof Error ? `Nao foi possivel remover a empresa: ${error.message}` : "Nao foi possivel remover a empresa.";
      setOverview(previousOverview);
      setMessage(errorMessage);
      showToast(errorMessage);
    } finally {
      setDeletingCompanyId(null);
    }
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

  const companyNames = Object.keys(overview.companyCounts).sort((a, b) => a.localeCompare(b));
  const adminCompanies = [...overview.companies].sort((a, b) => a.name.localeCompare(b.name));
  const filteredUsers = overview.users.filter((user) => companyFilter === "all" || (user.company || "Sem empresa") === companyFilter);
  const filteredProjects = overview.projects.filter((project) => companyFilter === "all" || (project.company || "Sem empresa") === companyFilter);
  const premiumByCompany = companyNames.filter((company) => overview.companyCounts[company]?.premium > 0);

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
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[.14em]"><Building2 size={16} /> Empresas</h2>
              <p className="mt-1 text-xs text-[#7c8b83]">Gestao de tenants, planos e base B2B.</p>
            </div>
            <button type="button" onClick={() => setCreateCompanyOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#b7f34a] px-4 py-3 text-xs font-black text-[#09120d]"><PlusCircle size={15} /> Criar Empresa</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {adminCompanies.length ? adminCompanies.map((company) => <div key={company.id} className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="truncate text-sm font-black text-[#e8efeb]">{company.name}</div>
                  <div className="mt-2 text-xs text-[#8c9a93]">{company.user_count} usuarios · {company.premium_users} premium</div>
                </div>
                <CreditCard className="text-[#b7f34a]" size={16} />
              </div>
              <label className="mt-4 block text-xs font-bold text-[#aab8b1]">Plano
                <select
                  value={company.plan}
                  disabled={savingPlanCompanyId === company.id || deletingCompanyId === company.id}
                  onChange={(event) => updateCompanyPlan(company, normalizeCompanyPlan(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-[#34423c] bg-[#080c0b] px-3 py-2 text-xs font-black text-[#eef5f1] outline-none focus:border-[#b7f34a] disabled:opacity-60"
                >
                  {COMPANY_PLANS.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                </select>
              </label>
              <button
                type="button"
                disabled={deletingCompanyId === company.id}
                onClick={() => setDeleteCompanyTarget(company)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#5b2727] px-3 py-2.5 text-xs font-black text-[#ff8f8f] transition hover:bg-[#2a1111] disabled:opacity-50"
              >
                <Trash2 size={13} /> {deletingCompanyId === company.id ? "Removendo..." : "Remover empresa"}
              </button>
            </div>) : <div className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4 text-sm text-[#8c9a93]">Nenhuma empresa criada ainda.</div>}
          </div>
        </section>

        <section className="rounded-3xl border border-[#26312c] bg-[#101613] p-5 xl:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[.14em]">Filtro por empresa</h2>
              <p className="mt-1 text-xs text-[#7c8b83]">Filtra usuarios e projetos por tenant/company.</p>
            </div>
            <label className="text-xs font-bold text-[#aab8b1]">Empresa
              <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} className="mt-1 min-w-56 rounded-xl border border-[#34423c] bg-[#0b100e] px-4 py-3 text-sm text-[#eef5f1] outline-none focus:border-[#b7f34a]">
                <option value="all">Todas as empresas</option>
                {companyNames.map((company) => <option key={company} value={company}>{company}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {companyNames.map((company) => <div key={company} className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4">
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
            onAction={(user) => setRemoveCompanyUser(user)}
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
              <thead className="text-[#7c8b83]"><tr><th className="py-2">Email</th><th>Empresa</th><th>ID</th><th>Criado em</th><th>Ultimo login</th><th>Acoes</th></tr></thead>
              <tbody>
                {filteredUsers.map((user) => <tr key={user.id} className="border-t border-[#26312c]">
                  <td className="py-3 font-bold text-[#e8efeb]">{user.email}</td>
                  <td className="text-[#9aa8a1]"><CompanyBadge company={user.company} premium={user.premium} /></td>
                  <td className="max-w-[180px] truncate text-[#9aa8a1]">{user.id}</td>
                  <td className="text-[#9aa8a1]">{formatDate(user.created_at)}</td>
                  <td className="text-[#9aa8a1]">{formatOptionalDate(user.last_sign_in_at)}</td>
                  <td>
                    {user.company ? <button
                      type="button"
                      disabled={companySavingUserId === user.id}
                      onClick={() => setRemoveCompanyUser(user)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black text-[#ff8f8f] transition hover:bg-[#2a1111] disabled:opacity-50"
                    >
                      <XCircle size={12} /> Remover
                    </button> : <span className="text-[10px] font-bold text-[#5f6b65]">Sem empresa</span>}
                  </td>
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
            {companyNames.filter((company) => company !== "Sem empresa" && company !== "SM&A").map((company) => <option key={company} value={company}>{company}</option>)}
          </select>
        </label>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setCompanyModalUser(null)} className="rounded-xl border border-[#34413b] px-4 py-3 text-xs font-black text-[#d6e0da] transition hover:border-[#b7f34a] hover:text-[#b7f34a]">Cancelar</button>
          <button type="button" onClick={() => updateUserCompany(companyModalUser, companyInput)} className="rounded-xl bg-[#b7f34a] px-4 py-3 text-xs font-black text-[#09120d] transition hover:brightness-105">Confirmar</button>
        </div>
      </div>
    </div>}

    {removeCompanyUser && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[#4a2a2a] bg-[#101613] p-6 shadow-2xl shadow-black/50">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#2a1111] text-[#ff8f8f]"><XCircle size={22} /></div>
        <h3 className="mt-4 text-xl font-black">Remover da empresa</h3>
        <p className="mt-2 text-sm leading-6 text-[#9caaa3]">
          Deseja remover <span className="font-bold text-[#e8efeb]">{removeCompanyUser.email}</span> da empresa <span className="font-bold text-[#e8efeb]">{removeCompanyUser.company}</span>?
        </p>
        <p className="mt-2 text-xs leading-5 text-[#7c8b83]">O usuario sera movido automaticamente para a lista SEM EMPRESA.</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={companySavingUserId === removeCompanyUser.id} onClick={() => setRemoveCompanyUser(null)} className="rounded-xl border border-[#34413b] px-4 py-3 text-xs font-black text-[#d6e0da] transition hover:border-[#b7f34a] hover:text-[#b7f34a] disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={companySavingUserId === removeCompanyUser.id} onClick={confirmRemoveUserCompany} className="rounded-xl bg-[#ff8f8f] px-4 py-3 text-xs font-black text-[#190909] transition hover:brightness-105 disabled:opacity-60">
            {companySavingUserId === removeCompanyUser.id ? "Removendo..." : "Confirmar remocao"}
          </button>
        </div>
      </div>
    </div>}

    {deleteCompanyTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[#4a2a2a] bg-[#101613] p-6 shadow-2xl shadow-black/50">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#2a1111] text-[#ff8f8f]"><Trash2 size={22} /></div>
        <h3 className="mt-4 text-xl font-black">Remover empresa</h3>
        <p className="mt-2 text-sm leading-6 text-[#9caaa3]">
          Tem certeza que deseja excluir a empresa <span className="font-bold text-[#e8efeb]">{deleteCompanyTarget.name}</span>? Isso removera todos os vinculos dos usuarios com essa empresa.
        </p>
        <p className="mt-2 text-xs leading-5 text-[#7c8b83]">Os usuarios vinculados ficarao automaticamente como SEM EMPRESA. Essa acao nao altera login, projetos ou editor CAD.</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={deletingCompanyId === deleteCompanyTarget.id} onClick={() => setDeleteCompanyTarget(null)} className="rounded-xl border border-[#34413b] px-4 py-3 text-xs font-black text-[#d6e0da] transition hover:border-[#b7f34a] hover:text-[#b7f34a] disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={deletingCompanyId === deleteCompanyTarget.id} onClick={deleteCompany} className="rounded-xl bg-[#ff8f8f] px-4 py-3 text-xs font-black text-[#190909] transition hover:brightness-105 disabled:opacity-60">
            {deletingCompanyId === deleteCompanyTarget.id ? "Removendo..." : "Confirmar exclusao"}
          </button>
        </div>
      </div>
    </div>}

    <section className="mx-auto max-w-7xl px-5 pb-8">
      <div className="rounded-3xl border border-[#26312c] bg-[#101613] p-5">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[.14em]"><ScrollText size={16} /> Logs de admin</h2>
        <div className="mt-4 grid gap-3">
          {overview.adminLogs.length ? overview.adminLogs.map((log) => <div key={log.id} className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-black text-[#e8efeb]">{log.action}</div>
                <div className="mt-1 text-xs text-[#8c9a93]">{log.target_type} · {log.target_id}</div>
              </div>
              <div className="text-xs text-[#7c8b83]">{formatDate(log.created_at)}</div>
            </div>
          </div>) : <div className="rounded-2xl border border-[#27352f] bg-[#0c110f] p-4 text-sm text-[#8c9a93]">Nenhum log registrado ainda.</div>}
        </div>
      </div>
    </section>

    {createCompanyOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[#33413a] bg-[#101613] p-6 shadow-2xl shadow-black/50">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#b7f34a] text-[#09120d]"><Building2 size={22} /></div>
        <h3 className="mt-4 text-xl font-black">Criar Empresa</h3>
        <p className="mt-2 text-sm leading-6 text-[#9caaa3]">Crie um tenant B2B com plano inicial.</p>
        <label className="mt-4 block text-xs font-bold text-[#aab8b1]">Nome da empresa
          <input value={newCompanyName} onChange={(event) => setNewCompanyName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#34423c] bg-[#0b100e] px-4 py-3 text-sm text-[#eef5f1] outline-none focus:border-[#b7f34a]" placeholder="SM&A" />
        </label>
        <label className="mt-4 block text-xs font-bold text-[#aab8b1]">Plano inicial
          <select value={newCompanyPlan} onChange={(event) => setNewCompanyPlan(normalizeCompanyPlan(event.target.value))} className="mt-2 w-full rounded-xl border border-[#34423c] bg-[#0b100e] px-4 py-3 text-sm text-[#eef5f1] outline-none focus:border-[#b7f34a]">
            {COMPANY_PLANS.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
          </select>
        </label>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setCreateCompanyOpen(false)} className="rounded-xl border border-[#34413b] px-4 py-3 text-xs font-black text-[#d6e0da] transition hover:border-[#b7f34a] hover:text-[#b7f34a]">Cancelar</button>
          <button type="button" disabled={savingCompany} onClick={createCompany} className="rounded-xl bg-[#b7f34a] px-4 py-3 text-xs font-black text-[#09120d] transition hover:brightness-105 disabled:opacity-60">{savingCompany ? "Criando..." : "Criar empresa"}</button>
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

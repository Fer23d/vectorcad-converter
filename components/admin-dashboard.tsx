"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, Clock3, FolderOpen, ShieldAlert, ShieldCheck, UsersRound } from "lucide-react";
import { isAdminUser } from "@/lib/admin";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

type AdminOverview = {
  stats: {
    totalUsers: number;
    totalProjects: number;
    activeUsers: number;
  };
  latestLogins: {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
  }[];
  users: {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
  }[];
  projects: {
    id: string;
    name: string;
    user_id: string;
    type: string;
    created_at: string;
    updated_at: string;
  }[];
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
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
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

        <section className="rounded-3xl border border-[#26312c] bg-[#101613] p-5">
          <h2 className="text-sm font-black uppercase tracking-[.14em]">Usuarios</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="text-[#7c8b83]"><tr><th className="py-2">Email</th><th>ID</th><th>Criado em</th><th>Ultimo login</th></tr></thead>
              <tbody>
                {overview.users.map((user) => <tr key={user.id} className="border-t border-[#26312c]">
                  <td className="py-3 font-bold text-[#e8efeb]">{user.email}</td>
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
              <thead className="text-[#7c8b83]"><tr><th className="py-2">Nome</th><th>User ID</th><th>Criado em</th></tr></thead>
              <tbody>
                {overview.projects.map((project) => <tr key={project.id} className="border-t border-[#26312c]">
                  <td className="py-3 font-bold text-[#e8efeb]">{project.name}</td>
                  <td className="max-w-[180px] truncate text-[#9aa8a1]">{project.user_id}</td>
                  <td className="text-[#9aa8a1]">{formatDate(project.created_at)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  </main>;
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

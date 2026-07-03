import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient, createSupabaseAuthServerClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

export async function GET(request: Request) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: "Supabase nao configurado." }, { status: 500 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Sessao ausente." }, { status: 401 });
  }

  const authClient = createSupabaseAuthServerClient(token);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }

  if (!isAdminUser(userData.user.id)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Configure SUPABASE_SERVICE_ROLE_KEY para ativar o painel admin." }, { status: 500 });
  }

  const adminClient = createSupabaseAdminClient();
  const [{ data: usersData, error: usersError }, { data: projectsData, error: projectsError }] = await Promise.all([
    adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    adminClient.from("projects").select("id,name,user_id,type,created_at,updated_at").order("created_at", { ascending: false }),
  ]);

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  if (projectsError) {
    return NextResponse.json({ error: projectsError.message }, { status: 500 });
  }

  const users = usersData.users.map((user) => ({
    id: user.id,
    email: user.email || "sem email",
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at || null,
  }));
  const projects = projectsData || [];
  const usersWithLogin = users.filter((user) => Boolean(user.last_sign_in_at));
  const latestLogins = [...usersWithLogin]
    .sort((a, b) => new Date(b.last_sign_in_at || 0).getTime() - new Date(a.last_sign_in_at || 0).getTime())
    .slice(0, 5);

  return NextResponse.json({
    stats: {
      totalUsers: users.length,
      totalProjects: projects.length,
      activeUsers: usersWithLogin.length,
    },
    latestLogins,
    users,
    projects,
  });
}

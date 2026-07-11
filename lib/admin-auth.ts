import { NextResponse } from "next/server";
import { ADMIN_EMAIL, ADMIN_ROLES, getUserRole, isAdminRole, normalizeAdminRole, type AdminRole } from "@/lib/admin";
import { createSupabaseAdminClient, createSupabaseAuthServerClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";

export { ADMIN_EMAIL, ADMIN_ROLES, getUserRole, isAdminRole, normalizeAdminRole, type AdminRole };

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

export async function requireAdmin(request: Request) {
  if (!isSupabaseServerConfigured) {
    return { response: NextResponse.json({ error: "Supabase não configurado." }, { status: 500 }) };
  }

  const token = bearerToken(request);
  if (!token) {
    return { response: NextResponse.json({ error: "Sessão ausente." }, { status: 401 }) };
  }

  const authClient = createSupabaseAuthServerClient(token);
  const { data, error } = await authClient.auth.getUser(token);
  const user = data.user;

  if (error || !user) {
    return { response: NextResponse.json({ error: "Sessão inválida. Faça login novamente." }, { status: 401 }) };
  }

  if (!user.email_confirmed_at) {
    return { response: NextResponse.json({ error: "Confirme seu e-mail antes de acessar a área administrativa." }, { status: 403 }) };
  }

  const role = getUserRole(user);
  if (!isAdminRole(role)) {
    return { response: NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 }) };
  }

  if (!isSupabaseAdminConfigured) {
    return { response: NextResponse.json({ error: "Configure SUPABASE_SERVICE_ROLE_KEY para ativar o painel admin." }, { status: 500 }) };
  }

  return {
    adminClient: createSupabaseAdminClient(),
    role,
    token,
    user,
  };
}

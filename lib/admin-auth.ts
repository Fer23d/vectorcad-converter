import { NextResponse } from "next/server";
import { ADMIN_ROLES, getUserRole, isAdminRole, normalizeAdminRole, type AdminRole } from "@/lib/admin";
import { createSupabaseAdminClient, createSupabaseAuthServerClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { recordSecurityEvent } from "@/lib/security/security-events";

export { ADMIN_ROLES, getUserRole, isAdminRole, normalizeAdminRole, type AdminRole };

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

  if (!isSupabaseAdminConfigured) {
    return { response: NextResponse.json({ error: "Configure SUPABASE_SERVICE_ROLE_KEY para ativar o painel admin." }, { status: 500 }) };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: roleRow, error: roleError } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleError) {
    return { response: NextResponse.json({ error: "Não foi possível validar a permissão administrativa." }, { status: 500 }) };
  }

  const role = getUserRole(roleRow?.role);
  if (!isAdminRole(role)) {
    return { response: NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 }) };
  }

  return {
    adminClient,
    role,
    token,
    user,
  };
}

type AdminAuthContext = Exclude<Awaited<ReturnType<typeof requireAdmin>>, { response: NextResponse }>;

function hasVerifiedTotpFactor(factors: unknown) {
  if (!Array.isArray(factors)) return false;
  return factors.some((factor) => {
    if (!factor || typeof factor !== "object") return false;
    const row = factor as { factor_type?: unknown; status?: unknown };
    return row.factor_type === "totp" && row.status === "verified";
  });
}

async function hasAnyAdminWithVerifiedMfa(adminClient: AdminAuthContext["adminClient"]) {
  const { data: roleRows, error: roleError } = await adminClient
    .from("user_roles")
    .select("user_id,role")
    .eq("role", ADMIN_ROLES.ADMIN);

  if (roleError) {
    return { ok: false, error: roleError.message, hasAdminWithMfa: false };
  }

  for (const row of roleRows || []) {
    if (!row.user_id) continue;
    const { data, error } = await adminClient.auth.admin.mfa.listFactors({ userId: row.user_id });
    if (error) return { ok: false, error: error.message, hasAdminWithMfa: false };
    if (hasVerifiedTotpFactor(data?.factors)) {
      return { ok: true, hasAdminWithMfa: true };
    }
  }

  return { ok: true, hasAdminWithMfa: false };
}

export async function requireAdminWithMFA(request: Request) {
  const adminAuth = await requireAdmin(request);
  if ("response" in adminAuth) return adminAuth;

  const bootstrap = await hasAnyAdminWithVerifiedMfa(adminAuth.adminClient);
  if (!bootstrap.ok) {
    return { response: NextResponse.json({ error: "Não foi possível validar a configuração MFA administrativa." }, { status: 500 }) };
  }

  if (!bootstrap.hasAdminWithMfa) {
    await recordSecurityEvent({
      eventType: "MFA_REQUIRED",
      success: false,
      userId: adminAuth.user.id,
      metadata: { reason: "ADMIN_MFA_BOOTSTRAP_REQUIRED" },
    });
    return {
      response: NextResponse.json({
        error: "Configure MFA antes de executar operações administrativas críticas.",
        code: "MFA_BOOTSTRAP_REQUIRED",
      }, { status: 403 }),
    };
  }

  const authClient = createSupabaseAuthServerClient(adminAuth.token);
  const { data, error } = await authClient.auth.mfa.getAuthenticatorAssuranceLevel(adminAuth.token);
  if (error || data.currentLevel !== "aal2") {
    await recordSecurityEvent({
      eventType: "MFA_REQUIRED",
      success: false,
      userId: adminAuth.user.id,
      metadata: {
        reason: error ? "AAL_LOOKUP_FAILED" : "AAL2_REQUIRED",
        currentLevel: data?.currentLevel || null,
        nextLevel: data?.nextLevel || null,
      },
    });
    return {
      response: NextResponse.json({
        error: "Confirme o MFA para executar esta ação administrativa.",
        code: "MFA_REQUIRED",
      }, { status: 403 }),
    };
  }

  return adminAuth;
}

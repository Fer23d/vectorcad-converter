import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseAuthServerClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function isMissingProfileTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() || "";
  return error.code === "42P01" || error.code === "PGRST205" || message.includes("schema cache");
}

export async function PATCH(request: Request) {
  if (!isSupabaseServerConfigured || !isSupabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase server não configurado." }, { status: 500 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Sessão ausente." }, { status: 401 });
  }

  const authClient = createSupabaseAuthServerClient(token);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const firstName = cleanName(body.first_name);
  const lastName = cleanName(body.last_name);
  const adminClient = createSupabaseAdminClient();
  const existingMetadata = userData.user.user_metadata || {};

  // Only personal fields are updated here. Company, plan and premium flags are
  // intentionally preserved because they are controlled by billing/admin flows.
  const { data: updatedUser, error: metadataError } = await adminClient.auth.admin.updateUserById(userData.user.id, {
    user_metadata: {
      ...existingMetadata,
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (metadataError) {
    return NextResponse.json({ error: metadataError.message }, { status: 500 });
  }

  const { data: currentProfile } = await adminClient
    .from("profiles")
    .select("company,plan,is_premium,payment_status")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .upsert({
      user_id: userData.user.id,
      name: firstName,
      surname: lastName,
      company: currentProfile?.company || null,
      plan: currentProfile?.plan || existingMetadata.plan || "free",
      is_premium: Boolean(currentProfile?.is_premium || existingMetadata.is_premium),
      payment_status: currentProfile?.payment_status || existingMetadata.payment_status || "none",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (profileError && !isMissingProfileTable(profileError)) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({
    user: updatedUser.user,
    profile: profile || {
      user_id: userData.user.id,
      name: firstName,
      surname: lastName,
      company: currentProfile?.company || null,
    },
  });
}

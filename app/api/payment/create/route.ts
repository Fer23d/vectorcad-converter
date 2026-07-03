import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseAuthServerClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { mercadoPagoRequest, PRO_PLAN } from "@/lib/mercadopago";

type PreapprovalResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
  status: string;
};

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: "Supabase nao configurado." }, { status: 500 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Sessao ausente." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const plan = String(body.plan || "pro");

  if (plan !== "pro") {
    return NextResponse.json({ error: "Plano invalido." }, { status: 400 });
  }

  const authClient = createSupabaseAuthServerClient(token);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);

  if (userError || !userData.user?.email) {
    return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  }

  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "https://vetorcad.com.br";
  const user = userData.user;
  const preapproval = await mercadoPagoRequest<PreapprovalResponse>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: PRO_PLAN.title,
      external_reference: user.id,
      payer_email: user.email,
      back_url: `${origin}/pricing?payment=success`,
      status: "pending",
      auto_recurring: {
        frequency: PRO_PLAN.frequency,
        frequency_type: PRO_PLAN.frequencyType,
        transaction_amount: PRO_PLAN.price,
        currency_id: PRO_PLAN.currency,
      },
      metadata: {
        user_id: user.id,
        email: user.email,
        plan: PRO_PLAN.id,
      },
    }),
  });

  if (isSupabaseAdminConfigured) {
    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.from("subscriptions").upsert({
      user_id: user.id,
      email: user.email,
      provider: "mercadopago",
      provider_subscription_id: preapproval.id,
      plan: "pro",
      status: preapproval.status || "pending",
      amount: PRO_PLAN.price,
      currency: PRO_PLAN.currency,
      raw: preapproval,
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider_subscription_id" });

    if (error && error.code !== "42P01") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    id: preapproval.id,
    preference_id: preapproval.id,
    init_point: preapproval.init_point || preapproval.sandbox_init_point,
    public_key_configured: Boolean(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY),
  });
}

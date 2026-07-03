import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseAuthServerClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { getMercadoPagoPlan, mercadoPagoRequest } from "@/lib/mercadopago";
import { isBillablePlan } from "@/lib/billing";

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

function isMissingSubscriptionsTable(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.code === "PGRST205" || error.message?.toLowerCase().includes("subscriptions");
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: "Supabase nao configurado." }, { status: 500 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Sessao ausente." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const plan = String(body.plan || "pro");

    if (!isBillablePlan(plan)) {
      return NextResponse.json({ error: "Plano invalido. Use plus, pro ou empresarial." }, { status: 400 });
    }

    const billingPlan = getMercadoPagoPlan(plan);
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
        reason: billingPlan.checkoutTitle,
        external_reference: user.id,
        payer_email: user.email,
        back_url: `${origin}/pricing?payment=success&plan=${billingPlan.id}`,
        status: "pending",
        auto_recurring: {
          frequency: billingPlan.frequency,
          frequency_type: billingPlan.frequencyType,
          transaction_amount: billingPlan.price,
          currency_id: billingPlan.currency,
        },
        metadata: {
          user_id: user.id,
          email: user.email,
          plan: billingPlan.id,
        },
      }),
    });

    if (isSupabaseAdminConfigured) {
      const adminClient = createSupabaseAdminClient();
      const { error } = await adminClient.from("subscriptions").upsert({
        user_id: user.id,
        email: user.email,
        payment_provider: "mercadopago",
        external_id: preapproval.id,
        plan: billingPlan.id,
        status: preapproval.status || "pending",
        amount: billingPlan.price,
        currency: billingPlan.currency,
        raw: preapproval,
        updated_at: new Date().toISOString(),
      }, { onConflict: "external_id" });

      if (error && !isMissingSubscriptionsTable(error)) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      id: preapproval.id,
      preference_id: preapproval.id,
      init_point: preapproval.init_point || preapproval.sandbox_init_point,
      plan: billingPlan.id,
      price: billingPlan.price,
      public_key_configured: Boolean(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nao foi possivel criar checkout." }, { status: 500 });
  }
}

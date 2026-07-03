import { NextResponse } from "next/server";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/server";
import { mercadoPagoRequest, paymentStatusToPlan, PRO_PLAN } from "@/lib/mercadopago";

type MercadoPagoPreapproval = {
  id: string;
  status: string;
  external_reference?: string;
  payer_email?: string;
  reason?: string;
};

type MercadoPagoPayment = {
  id: number;
  status: string;
  external_reference?: string;
  payer?: {
    email?: string;
  };
  metadata?: {
    user_id?: string;
    email?: string;
  };
};

async function upsertProAccess(input: {
  userId?: string | null;
  email?: string | null;
  providerSubscriptionId?: string | null;
  status: string;
  raw: unknown;
}) {
  if (!isSupabaseAdminConfigured) return;

  const adminClient = createSupabaseAdminClient();
  const { plan, isPremium, paymentStatus } = paymentStatusToPlan(input.status);
  let userId = input.userId || null;
  const email = input.email || null;

  if (!userId && email) {
    const { data } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id || null;
  }

  if (!userId) return;

  const { data: userData } = await adminClient.auth.admin.getUserById(userId);
  if (userData.user) {
    await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(userData.user.user_metadata || {}),
        plan,
        is_premium: isPremium,
        payment_status: paymentStatus,
      },
    });
  }

  const { error: profileError } = await adminClient.from("profiles").upsert({
    user_id: userId,
    plan,
    is_premium: isPremium,
    payment_status: paymentStatus,
    mercado_pago_preapproval_id: input.providerSubscriptionId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (profileError && profileError.code !== "42P01" && profileError.code !== "42703") {
    throw profileError;
  }

  if (email) {
    const { error: subscriptionError } = await adminClient.from("subscriptions").upsert({
      user_id: userId,
      email,
      provider: "mercadopago",
      provider_subscription_id: input.providerSubscriptionId,
      plan: PRO_PLAN.id,
      status: paymentStatus,
      amount: PRO_PLAN.price,
      currency: PRO_PLAN.currency,
      raw: input.raw,
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider_subscription_id" });

    if (subscriptionError && subscriptionError.code !== "42P01") {
      throw subscriptionError;
    }
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const topic = url.searchParams.get("topic") || url.searchParams.get("type") || body.type || body.topic;
  const id = url.searchParams.get("id") || body.data?.id || body.id;

  if (!id) {
    return NextResponse.json({ ok: true, ignored: "missing_id" });
  }

  try {
    if (topic === "subscription_preapproval" || topic === "preapproval") {
      const subscription = await mercadoPagoRequest<MercadoPagoPreapproval>(`/preapproval/${id}`);
      await upsertProAccess({
        userId: subscription.external_reference,
        email: subscription.payer_email,
        providerSubscriptionId: subscription.id,
        status: subscription.status,
        raw: subscription,
      });
    } else if (topic === "payment") {
      const payment = await mercadoPagoRequest<MercadoPagoPayment>(`/v1/payments/${id}`);
      await upsertProAccess({
        userId: payment.external_reference || payment.metadata?.user_id,
        email: payment.payer?.email || payment.metadata?.email,
        providerSubscriptionId: String(payment.id),
        status: payment.status,
        raw: payment,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro no webhook." }, { status: 500 });
  }
}

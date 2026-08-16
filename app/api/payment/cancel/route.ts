import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/security/request";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/server";
import { mercadoPagoRequest } from "@/lib/mercadopago";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;
  if (!isSupabaseAdminConfigured) return NextResponse.json({ error: "Serviço de assinatura indisponível." }, { status: 503 });

  const limit = await consumeRateLimit(`payment-cancel:${auth.user.id}`, 3, 60 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ error: "Muitas tentativas. Aguarde antes de tentar novamente." }, { status: 429 });

  const adminClient = createSupabaseAdminClient();
  const { data: subscription, error: subscriptionError } = await adminClient
    .from("subscriptions")
    .select("id,external_id,status")
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionError) return NextResponse.json({ error: "Não foi possível consultar sua assinatura." }, { status: 500 });
  if (!subscription) return NextResponse.json({ error: "Nenhuma assinatura individual encontrada." }, { status: 404 });

  const status = String(subscription.status || "").toLowerCase();
  if (["cancelled", "canceled", "rejected"].includes(status)) return NextResponse.json({ ok: true, status: "cancelled" });
  if (!subscription.external_id) return NextResponse.json({ error: "A assinatura não possui identificador do provedor." }, { status: 409 });

  try {
    await mercadoPagoRequest(`/preapproval/${encodeURIComponent(subscription.external_id)}`, {
      method: "PUT",
      body: JSON.stringify({ status: "cancelled" }),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível cancelar a assinatura no Mercado Pago." }, { status: 502 });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await adminClient.from("subscriptions").update({ status: "cancelled", updated_at: now }).eq("id", subscription.id).eq("user_id", auth.user.id);
  if (updateError) return NextResponse.json({ error: "A assinatura foi cancelada no provedor, mas não foi possível atualizar o cadastro local." }, { status: 500 });

  await adminClient.from("profiles").update({ plan: "free", is_premium: false, payment_status: "cancelled", updated_at: now }).eq("user_id", auth.user.id);
  await adminClient.from("users").update({ plan: "free", is_premium: false, payment_status: "cancelled", updated_at: now }).eq("id", auth.user.id);

  return NextResponse.json({ ok: true, status: "cancelled" });
}

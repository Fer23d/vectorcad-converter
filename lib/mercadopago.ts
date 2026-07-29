import { normalizeCompanyPlan } from "@/lib/access-control";
import { getBillingPlan, type BillablePlan } from "@/lib/billing";
import { createHmac, timingSafeEqual } from "node:crypto";

const MERCADOPAGO_API_BASE = "https://api.mercadopago.com";

function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "") || "";
}

export const mercadoPagoAccessToken = cleanEnv(process.env.MERCADOPAGO_ACCESS_TOKEN);
export const mercadoPagoPublicKey = cleanEnv(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY);

export const PRO_PLAN = getBillingPlan("pro");

export function isMercadoPagoConfigured() {
  return Boolean(mercadoPagoAccessToken);
}

export async function mercadoPagoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!mercadoPagoAccessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado.");
  }

  const response = await fetch(`${MERCADOPAGO_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${mercadoPagoAccessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Erro Mercado Pago.");
  }

  return payload as T;
}

export function paymentStatusToPlan(status?: string | null, requestedPlan?: string | null) {
  const approvedStatuses = new Set(["authorized", "approved"]);
  const normalizedStatus = status || "pending";
  const normalizedPlan = normalizeCompanyPlan(requestedPlan || "pro");
  const safePlan = normalizedPlan === "free" ? "pro" : normalizedPlan;
  return {
    plan: approvedStatuses.has(normalizedStatus) ? safePlan : normalizeCompanyPlan("free"),
    isPremium: approvedStatuses.has(normalizedStatus) && (safePlan === "pro" || safePlan === "empresarial"),
    paymentStatus: normalizedStatus,
  };
}

export function getMercadoPagoPlan(plan: BillablePlan) {
  return getBillingPlan(plan);
}

export function verifyMercadoPagoWebhookSignature(request: Request, dataId: string) {
  const secret = cleanEnv(process.env.MERCADOPAGO_WEBHOOK_SECRET);
  const signature = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  if (!secret || !signature || !requestId || !dataId) return false;

  const parts = Object.fromEntries(signature.split(",").map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, value.join("=")];
  }));
  const timestamp = Number(parts.ts);
  const receivedHash = parts.v1 || "";
  if (!Number.isFinite(timestamp) || !receivedHash || Math.abs(Date.now() - timestamp * 1000) > 5 * 60 * 1000) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const expectedHash = createHmac("sha256", secret).update(manifest).digest("hex");
  const received = Buffer.from(receivedHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

import { normalizeCompanyPlan } from "@/lib/access-control";

const MERCADOPAGO_API_BASE = "https://api.mercadopago.com";

function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "") || "";
}

export const mercadoPagoAccessToken = cleanEnv(process.env.MERCADOPAGO_ACCESS_TOKEN);
export const mercadoPagoPublicKey = cleanEnv(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY);

export const PRO_PLAN = {
  id: "pro",
  title: "VectorCAD PRO",
  price: 29,
  currency: "BRL",
  frequency: 1,
  frequencyType: "months",
} as const;

export function isMercadoPagoConfigured() {
  return Boolean(mercadoPagoAccessToken);
}

export async function mercadoPagoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!mercadoPagoAccessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN nao configurado.");
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

export function paymentStatusToPlan(status?: string | null) {
  const approvedStatuses = new Set(["authorized", "approved"]);
  const normalizedStatus = status || "pending";
  return {
    plan: approvedStatuses.has(normalizedStatus) ? normalizeCompanyPlan("pro") : normalizeCompanyPlan("free"),
    isPremium: approvedStatuses.has(normalizedStatus),
    paymentStatus: normalizedStatus,
  };
}

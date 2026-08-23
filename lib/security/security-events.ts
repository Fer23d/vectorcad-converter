import { secureLogger } from "@/lib/security/logger";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/server";

export const SECURITY_EVENT_TYPES = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "ACCOUNT_LOCKED",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET_FAILED",
  "PASSWORD_RESET_SUCCESS",
  "PASSWORD_CHANGED",
  "PASSWORD_CHANGE_BLOCKED",
  "EMAIL_CONFIRMED",
  "LOGOUT",
  "MFA_SETUP_STARTED",
  "MFA_SETUP_FAILED",
  "MFA_ENABLED",
  "MFA_CHALLENGE_REQUESTED",
  "MFA_SUCCESS",
  "MFA_FAILED",
  "MFA_DISABLED",
  "MFA_REQUIRED",
  "RATE_LIMIT_BACKEND_UNAVAILABLE",
] as const;

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

const SENSITIVE_KEYS = /password|token|secret|authorization|cookie|credential|recovery|access|refresh|image|svg|cad|document|payload|link/i;
const MAX_METADATA_DEPTH = 3;
const MAX_STRING_LENGTH = 256;

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_METADATA_DEPTH) return "[TRUNCATED]";
  if (typeof value === "string") return value.length > MAX_STRING_LENGTH ? `[STRING:${value.length}]` : value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== "object") return "[UNSUPPORTED]";

  return Object.fromEntries(
    Object.entries(value).slice(0, 30).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.test(key) ? "[REDACTED]" : sanitizeValue(item, depth + 1),
    ]),
  );
}

export function sanitizeSecurityMetadata(metadata?: Record<string, unknown> | null) {
  if (!metadata) return {};
  return sanitizeValue(metadata, 0) as Record<string, unknown>;
}

function safeText(value: string | null | undefined, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || null : null;
}

export type SecurityEventInput = {
  eventType: SecurityEventType;
  userId?: string | null;
  success: boolean;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Server-only security event sink. It never accepts credentials or raw recovery data. */
export async function recordSecurityEvent(input: SecurityEventInput) {
  if (!isSupabaseAdminConfigured) {
    secureLogger.error("[security-events] admin client unavailable", { eventType: input.eventType });
    return { ok: false };
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.from("auth_security_events").insert({
      user_id: safeText(input.userId, 80),
      event_type: input.eventType,
      success: input.success,
      ip: safeText(input.ip, 64),
      user_agent: safeText(input.userAgent, 512),
      metadata: sanitizeSecurityMetadata(input.metadata),
    });

    if (error) {
      secureLogger.error("[security-events] insert failed", { eventType: input.eventType, code: error.code || "UNKNOWN" });
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    secureLogger.error("[security-events] unexpected failure", { eventType: input.eventType, code: error instanceof Error ? error.name : "UNKNOWN" });
    return { ok: false };
  }
}

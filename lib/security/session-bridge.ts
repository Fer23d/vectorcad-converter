export const SESSION_BRIDGE_COOKIE = "vetorcad_session";
export const SESSION_BRIDGE_MAX_AGE_SECONDS = 60 * 60;

export type SessionBridgeRole = "ADMIN" | "USER";

export type SessionBridgePayload = {
  sub: string;
  role: SessionBridgeRole;
  emailConfirmed: boolean;
  mfaSatisfied: boolean;
  aal?: string | null;
  iat: number;
  exp: number;
};

export type SessionBridgeVerification =
  | { valid: true; payload: SessionBridgePayload }
  | { valid: false; reason: "MISSING" | "FORMAT" | "SECRET" | "SIGNATURE" | "EXPIRED" | "PAYLOAD" };

const encoder = new TextEncoder();

function base64UrlEncode(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeText(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

export function getSessionBridgeSecret() {
  return process.env.SESSION_BRIDGE_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || (process.env.NODE_ENV === "production" ? "" : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "vetorcad-dev-session-bridge");
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function isPayload(value: unknown): value is SessionBridgePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<SessionBridgePayload>;
  return typeof payload.sub === "string"
    && (payload.role === "ADMIN" || payload.role === "USER")
    && typeof payload.emailConfirmed === "boolean"
    && typeof payload.mfaSatisfied === "boolean"
    && typeof payload.iat === "number"
    && typeof payload.exp === "number";
}

export async function signSessionBridgePayload(payload: SessionBridgePayload) {
  const secret = getSessionBridgeSecret();
  if (!secret) throw new Error("SESSION_BRIDGE_SECRET_MISSING");
  const body = base64UrlEncode(JSON.stringify(payload));
  const key = await hmacKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return `${body}.${base64UrlEncode(signature)}`;
}

export async function verifySessionBridgeCookie(cookieValue?: string | null): Promise<SessionBridgeVerification> {
  if (!cookieValue) return { valid: false, reason: "MISSING" };
  const [body, signature] = cookieValue.split(".");
  if (!body || !signature) return { valid: false, reason: "FORMAT" };
  const secret = getSessionBridgeSecret();
  if (!secret) return { valid: false, reason: "SECRET" };

  try {
    const key = await hmacKey(secret);
    const validSignature = await crypto.subtle.verify("HMAC", key, base64UrlDecode(signature), encoder.encode(body));
    if (!validSignature) return { valid: false, reason: "SIGNATURE" };

    const payload = JSON.parse(decodeText(base64UrlDecode(body))) as unknown;
    if (!isPayload(payload)) return { valid: false, reason: "PAYLOAD" };
    if (payload.exp <= Math.floor(Date.now() / 1000)) return { valid: false, reason: "EXPIRED" };

    return { valid: true, payload };
  } catch {
    return { valid: false, reason: "PAYLOAD" };
  }
}

export function sessionBridgeCookieOptions(maxAge = SESSION_BRIDGE_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

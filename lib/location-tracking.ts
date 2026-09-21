export type VercelLocation = {
  city: string;
  region: string;
  country: string;
};

function cleanHeader(value: string | null) {
  if (!value) return "";
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

export function extractVercelLocation(headers: Headers): VercelLocation | null {
  const city = cleanHeader(headers.get("x-vercel-ip-city"));
  const region = cleanHeader(headers.get("x-vercel-ip-country-region"));
  const country = cleanHeader(headers.get("x-vercel-ip-country"));
  if (!city && !region && !country) return null;
  return {
    city: city || "Não informado",
    region: region || "Não informado",
    country: country || "Não informado",
  };
}

export function sanitizeIpAddress(value: string | null) {
  const first = (value || "").split(",")[0]?.trim() || "";
  return first.slice(0, 128) || null;
}

export function dailyLocationKey(input: { userId?: string | null; ipAddress?: string | null; date?: Date }) {
  const day = (input.date || new Date()).toISOString().slice(0, 10);
  const owner = input.userId ? `user:${input.userId}` : `ip:${input.ipAddress || "unknown"}`;
  return `${owner}:${day}`;
}

import { NextResponse } from "next/server";
import { extractVercelLocation, isBotUserAgent, sanitizeIpAddress } from "@/lib/location-tracking";
import { createSupabaseAdminClient, createSupabaseAuthServerClient, isSupabaseAdminConfigured, isSupabaseServerConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const [type, token] = header.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

function isMissingLocationTable(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() || "";
  return error.code === "42P01" || error.code === "42703" || error.code === "PGRST205" || message.includes("schema cache");
}

async function resolveUserId(request: Request) {
  const token = bearerToken(request);
  if (!token || !isSupabaseServerConfigured) return null;
  const authClient = createSupabaseAuthServerClient(token);
  const { data } = await authClient.auth.getUser(token);
  return data.user?.id || null;
}

function todayRange() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent");
  if (isBotUserAgent(userAgent)) {
    return NextResponse.json({ message: "Bot ignored" }, { status: 200 });
  }

  const location = extractVercelLocation(request.headers);
  if (!location) {
    return NextResponse.json({ ok: true, tracked: false, reason: "LOCATION_HEADERS_MISSING" });
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ ok: false, tracked: false, reason: "SUPABASE_ADMIN_NOT_CONFIGURED" }, { status: 500 });
  }

  const userId = await resolveUserId(request);
  const ipAddress = sanitizeIpAddress(request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"));
  const adminClient = createSupabaseAdminClient();
  const { start, end } = todayRange();

  try {
    let existingQuery = adminClient
      .from("user_locations")
      .select("id")
      .gte("created_at", start)
      .lt("created_at", end)
      .limit(1);

    existingQuery = userId
      ? existingQuery.eq("user_id", userId)
      : ipAddress
        ? existingQuery.eq("ip_address", ipAddress).is("user_id", null)
        : existingQuery.eq("country", location.country).eq("city", location.city).is("user_id", null);

    const { data: existing, error: existingError } = await existingQuery;
    if (existingError && !isMissingLocationTable(existingError)) throw existingError;
    if (existing?.length) {
      return NextResponse.json({ ok: true, tracked: false, reason: "ALREADY_TRACKED_TODAY" });
    }

    const { error } = await adminClient.from("user_locations").insert({
      user_id: userId,
      ip_address: ipAddress,
      city: location.city,
      region: location.region,
      country: location.country,
      latitude: location.latitude,
      longitude: location.longitude,
    });

    if (error) {
      if (error.code === "23505") return NextResponse.json({ ok: true, tracked: false, reason: "ALREADY_TRACKED_TODAY" });
      throw error;
    }

    return NextResponse.json({ ok: true, tracked: true });
  } catch (error) {
    const databaseUnavailable = typeof error === "object" && error !== null && isMissingLocationTable(error as { code?: string; message?: string });
    return NextResponse.json({
      ok: false,
      tracked: false,
      reason: databaseUnavailable ? "LOCATION_TABLE_MISSING" : "LOCATION_TRACKING_FAILED",
    }, { status: databaseUnavailable ? 503 : 500 });
  }
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

type LocationRow = {
  id: string;
  user_id: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.adminClient
    .from("user_locations")
    .select("id,user_id,city,region,country,created_at")
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) {
    return NextResponse.json({ error: "Não foi possível carregar o relatório de localização." }, { status: 500 });
  }

  const rows = (data || []) as LocationRow[];
  const countryCounts = rows.reduce<Record<string, number>>((acc, row) => {
    const country = row.country || "Não informado";
    acc[country] = (acc[country] || 0) + 1;
    return acc;
  }, {});
  const topCountry = Object.entries(countryCounts).sort((left, right) => right[1] - left[1])[0] || null;

  return NextResponse.json({
    locations: rows,
    stats: {
      totalAccesses: rows.length,
      topCountry: topCountry ? { country: topCountry[0], accesses: topCountry[1] } : null,
    },
  });
}

import { describe, expect, it } from "vitest";
import { dailyLocationKey, extractVercelLocation, isBotUserAgent, sanitizeIpAddress } from "@/lib/location-tracking";

describe("user location tracking", () => {
  it("extracts city, region and country from Vercel headers", () => {
    const headers = new Headers({
      "x-vercel-ip-city": "S%C3%A3o%20Paulo",
      "x-vercel-ip-country-region": "SP",
      "x-vercel-ip-country": "BR",
      "x-vercel-ip-latitude": "-23.5505",
      "x-vercel-ip-longitude": "-46.6333",
    });

    expect(extractVercelLocation(headers)).toEqual({
      city: "São Paulo",
      region: "SP",
      country: "BR",
      latitude: -23.5505,
      longitude: -46.6333,
    });
  });

  it("ignores invalid latitude and longitude values", () => {
    const headers = new Headers({
      "x-vercel-ip-city": "Curitiba",
      "x-vercel-ip-country-region": "PR",
      "x-vercel-ip-country": "BR",
      "x-vercel-ip-latitude": "invalid",
      "x-vercel-ip-longitude": "",
    });

    expect(extractVercelLocation(headers)).toEqual({
      city: "Curitiba",
      region: "PR",
      country: "BR",
      latitude: null,
      longitude: null,
    });
  });

  it("returns null when location headers are missing", () => {
    expect(extractVercelLocation(new Headers())).toBeNull();
  });

  it("keeps only the first forwarded IP address", () => {
    expect(sanitizeIpAddress("203.0.113.10, 198.51.100.2")).toBe("203.0.113.10");
  });

  it("detects bot and crawler user agents", () => {
    expect(isBotUserAgent("Mozilla/5.0 Googlebot/2.1")).toBe(true);
    expect(isBotUserAgent("BingPreview crawler")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 Chrome/120.0 Safari/537.36")).toBe(false);
  });

  it("creates a daily dedupe key from user or IP", () => {
    expect(dailyLocationKey({ userId: "user-1", ipAddress: "203.0.113.10", date: new Date("2026-09-21T10:00:00Z") })).toBe("user:user-1:2026-09-21");
    expect(dailyLocationKey({ userId: null, ipAddress: "203.0.113.10", date: new Date("2026-09-21T10:00:00Z") })).toBe("ip:203.0.113.10:2026-09-21");
  });
});

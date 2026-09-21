"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

const LOCATION_TRACKED_KEY = "vetorcad_location_tracked";

export function LocationTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(LOCATION_TRACKED_KEY) === "true") return;

    let cancelled = false;

    async function trackLocation() {
      try {
        const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        const headers: HeadersInit = data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
        const response = await fetch("/api/track-location", {
          method: "POST",
          headers,
          keepalive: true,
        });

        if (!cancelled && response.ok) {
          window.sessionStorage.setItem(LOCATION_TRACKED_KEY, "true");
        }
      } catch {
        // Tracking is best-effort and must never affect the product experience.
      }
    }

    void trackLocation();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

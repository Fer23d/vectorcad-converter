"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

type Refresh = () => void | Promise<void>;

/** Realtime invalidates the view; the protected admin API remains the source of truth. */
export function useAdminRealtime(refresh: Refresh, enabled: boolean) {
  useEffect(() => {
    const client = supabase;
    if (!enabled || !client) return;

    let disposed = false;
    let refreshTimer: number | undefined;
    let reconnectTimer: number | undefined;
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

    const scheduleRefresh = () => {
      if (disposed || refreshTimer !== undefined) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined;
        void Promise.resolve(refresh()).catch(() => undefined);
      }, 250);
    };

    const subscribe = () => {
      if (disposed || channel) return;
      channel = client
        .channel(`admin-dashboard-${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "users" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "companies" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "companies_users" }, scheduleRefresh)
        .subscribe((status) => {
          if (disposed) return;
          if (status === "SUBSCRIBED") {
            scheduleRefresh();
            return;
          }
          if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
            channel = null;
            if (reconnectTimer === undefined) {
              reconnectTimer = window.setTimeout(() => {
                reconnectTimer = undefined;
                subscribe();
              }, 3000);
            }
          }
        });
    };

    subscribe();

    // auth.users is server-only. Polling closes the gap for new users without a profile.
    const authUsersRefresh = window.setInterval(() => {
      void Promise.resolve(refresh()).catch(() => undefined);
    }, 60000);
    return () => {
      disposed = true;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      window.clearInterval(authUsersRefresh);
      if (channel) void client.removeChannel(channel);
    };
  }, [enabled, refresh]);
}

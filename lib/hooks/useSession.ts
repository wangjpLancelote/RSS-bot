"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/browser";

function parseJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch (_err) {
    return null;
  }
}

export default function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getBrowserClient();

    const bootstrap = async () => {
      try {
        const {
          data: { session: currentSession }
        } = await supabase.auth.getSession();

        const token = currentSession?.access_token;
        if (token) {
          const exp = parseJwtExp(token);
          const now = Math.floor(Date.now() / 1000);
          if (!exp || exp <= now) {
            await supabase.auth.signOut({ scope: "local" });
            setSession(null);
            supabase.realtime.setAuth("");
            setLoading(false);
            return;
          }
        }

        setSession(currentSession ?? null);
        if (token) {
          supabase.realtime.setAuth(token);
        } else {
          supabase.realtime.setAuth("");
        }
        setLoading(false);
      } catch (_err) {
        setSession(null);
        setLoading(false);
      }
    };

    bootstrap();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.access_token) {
        supabase.realtime.setAuth(nextSession.access_token);
      } else {
        supabase.realtime.setAuth("");
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/browser";

export default function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getBrowserClient();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      if (data.session?.access_token) {
        supabase.realtime.setAuth(data.session.access_token);
      }
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.access_token) {
        supabase.realtime.setAuth(nextSession.access_token);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

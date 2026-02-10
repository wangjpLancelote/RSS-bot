import { getBrowserClient } from "@/lib/supabase/browser";
import { requirePublicEnv } from "@/lib/publicEnv";

function getFunctionsBase() {
  const url = requirePublicEnv("NEXT_PUBLIC_SUPABASE_URL");
  return `${url.replace(/\/$/, "")}/functions/v1`;
}

export async function loginWithEdge(email: string, password: string) {
  const res = await fetch(`${getFunctionsBase()}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Login failed");
  }

  const supabase = getBrowserClient();
  if (data.session?.access_token && data.session?.refresh_token) {
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    });

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (sessionData.session?.access_token) {
      supabase.realtime.setAuth(sessionData.session.access_token);
    }
  }

  return data;
}

export async function logoutWithEdge() {
  const supabase = getBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (token) {
    await fetch(`${getFunctionsBase()}/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => undefined);
  }
}

import { getBrowserClient } from "@/lib/supabase/browser";

export function apiBase() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

export function apiUrl(path: string) {
  const base = apiBase();
  if (!path.startsWith("/")) {
    return `${base}/${path}`;
  }
  return `${base}${path}`;
}

export async function authFetch(path: string, options: RequestInit = {}) {
  const supabase = getBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(apiUrl(path), {
    ...options,
    headers
  });
}

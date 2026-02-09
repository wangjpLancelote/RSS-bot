import { getBrowserClient } from "@/lib/supabase/browser";

class ApiNetworkError extends Error {
  code = "API_NETWORK_UNREACHABLE";
}

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

export function apiErrorMessage(
  data: { error?: string; detail?: string; code?: string } | null | undefined,
  fallback: string
) {
  if (!data) return fallback;
  if (data.code?.endsWith("NETWORK_FAILURE")) {
    return "后端访问上游服务网络异常，请稍后重试";
  }
  if (data.detail) {
    return `${data.error || fallback}: ${data.detail}`;
  }
  return data.error || fallback;
}

export async function authFetch(path: string, options: RequestInit = {}) {
  const isBrowser = typeof window !== "undefined";
  if (isBrowser) {
    window.dispatchEvent(new CustomEvent("app:loading", { detail: { delta: 1 } }));
  }

  const supabase = getBrowserClient();
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers = new Headers(options.headers || {});

    if (!token) {
      throw new Error("会话已失效，请重新登录");
    }

    const makeRequest = async (accessToken: string) => {
      const requestHeaders = new Headers(headers);
      requestHeaders.set("Authorization", `Bearer ${accessToken}`);

      if (options.body && !requestHeaders.has("Content-Type")) {
        requestHeaders.set("Content-Type", "application/json");
      }

      const url = apiUrl(path);
      try {
        return await fetch(url, {
          ...options,
          headers: requestHeaders
        });
      } catch {
        throw new ApiNetworkError(`后端服务不可达: ${url}`);
      }
    };

    let response = await makeRequest(token);

    if (response.status === 401) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      const nextToken = refreshData.session?.access_token;

      if (!refreshError && nextToken && nextToken !== token) {
        response = await makeRequest(nextToken);
      }
    }

    if (response.status === 401) {
      response
        .clone()
        .json()
        .then((body) => {
          console.warn("[authFetch] 401", { path, error: body?.error, detail: body?.detail });
        })
        .catch(() => undefined);
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    }

    if (response.status === 503) {
      response
        .clone()
        .json()
        .then((body) => {
          console.warn("[authFetch] 503", { path, error: body?.error, detail: body?.detail, code: body?.code });
        })
        .catch(() => undefined);
    }

    return response;
  } finally {
    if (isBrowser) {
      window.dispatchEvent(new CustomEvent("app:loading", { detail: { delta: -1 } }));
    }
  }
}

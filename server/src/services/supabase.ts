import { createClient } from "@supabase/supabase-js";

function readEnvTrimmed(key: string) {
  const raw = process.env[key];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (raw !== trimmed) {
    console.warn(`[env] trimmed whitespace for ${key}`);
  }
  return trimmed;
}

export const SUPABASE_URL = readEnvTrimmed("SUPABASE_URL");
const SERVICE_KEY = readEnvTrimmed("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = readEnvTrimmed("SUPABASE_ANON_KEY") || readEnvTrimmed("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

if (!ANON_KEY) {
  throw new Error("Missing SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const serverAuthConfig = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
} as const;

export const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  ...serverAuthConfig
});

export const authClient = createClient(SUPABASE_URL, ANON_KEY, {
  ...serverAuthConfig
});

function formatNetworkError(err: unknown) {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: { code?: string; hostname?: string; address?: string } }).cause;
    const parts = [err.message];
    if (cause?.code) parts.push(`code=${cause.code}`);
    if (cause?.hostname) parts.push(`host=${cause.hostname}`);
    if (cause?.address) parts.push(`addr=${cause.address}`);
    return parts.join(" ");
  }
  return "unknown error";
}

export async function checkSupabaseAuthHealth(timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/health`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: ANON_KEY!
      },
      signal: controller.signal
    });
    return {
      ok: res.ok,
      status: res.status
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      error: formatNetworkError(err)
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkSupabaseRestHealth(timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`
      },
      signal: controller.signal
    });
    return {
      ok: res.status < 500,
      status: res.status
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      error: formatNetworkError(err)
    };
  } finally {
    clearTimeout(timer);
  }
}

function isNetworkFailureMessage(message = "") {
  const lower = message.toLowerCase();
  return lower.includes("fetch failed") || lower.includes("enotfound") || lower.includes("econnrefused") || lower.includes("timeout");
}

export async function verifyAuthToken(token: string): Promise<
  | { ok: true; userId: string; email: string | null }
  | { ok: false; status: 401 | 503; code: string; detail: string }
> {
  const claimsResult = await authClient.auth.getClaims(token);
  if (!claimsResult.error && claimsResult.data?.claims?.sub) {
    return {
      ok: true,
      userId: String(claimsResult.data.claims.sub),
      email: typeof claimsResult.data.claims.email === "string" ? claimsResult.data.claims.email : null
    };
  }

  const claimError = claimsResult.error?.message || "";
  if (isNetworkFailureMessage(claimError)) {
    return {
      ok: false,
      status: 503,
      code: "AUTH_UPSTREAM_UNAVAILABLE",
      detail: claimError
    };
  }

  const userResult = await authClient.auth.getUser(token);
  if (!userResult.error && userResult.data.user?.id) {
    return {
      ok: true,
      userId: userResult.data.user.id,
      email: userResult.data.user.email || null
    };
  }

  const userError = userResult.error?.message || "";
  if (isNetworkFailureMessage(userError)) {
    return {
      ok: false,
      status: 503,
      code: "AUTH_UPSTREAM_UNAVAILABLE",
      detail: userError
    };
  }

  return {
    ok: false,
    status: 401,
    code: "AUTH_INVALID_TOKEN",
    detail: userError || claimError || "Token validation failed"
  };
}

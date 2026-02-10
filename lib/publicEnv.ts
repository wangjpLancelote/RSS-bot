export type PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_API_BASE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

declare global {
  interface Window {
    __PUBLIC_ENV__?: PublicEnv;
  }
}

function trimmed(value: unknown) {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return v.length ? v : undefined;
}

function readFromProcessEnv(): PublicEnv {
  // In local Next.js dev/build, NEXT_PUBLIC_* may be inlined or available here.
  // In Cloudflare Workers, these values should be available at runtime (and also
  // injected into window.__PUBLIC_ENV__ for browser code).
  const env =
    typeof process !== "undefined" && typeof process.env !== "undefined" ? process.env : undefined;

  return {
    NEXT_PUBLIC_SUPABASE_URL: trimmed(env?.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: trimmed(env?.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_API_BASE_URL: trimmed(env?.NEXT_PUBLIC_API_BASE_URL),
    NEXT_PUBLIC_SITE_URL: trimmed(env?.NEXT_PUBLIC_SITE_URL)
  };
}

export function readPublicEnv(): PublicEnv {
  if (typeof window !== "undefined" && window.__PUBLIC_ENV__) {
    return {
      NEXT_PUBLIC_SUPABASE_URL: trimmed(window.__PUBLIC_ENV__.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: trimmed(window.__PUBLIC_ENV__.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      NEXT_PUBLIC_API_BASE_URL: trimmed(window.__PUBLIC_ENV__.NEXT_PUBLIC_API_BASE_URL),
      NEXT_PUBLIC_SITE_URL: trimmed(window.__PUBLIC_ENV__.NEXT_PUBLIC_SITE_URL)
    };
  }
  return readFromProcessEnv();
}

export function requirePublicEnv<K extends keyof PublicEnv>(key: K): string {
  const value = readPublicEnv()[key];
  if (!value) {
    throw new Error(`Missing ${key}`);
  }
  return value;
}


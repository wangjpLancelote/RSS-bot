import type { PublicEnv } from "@/lib/publicEnv";
import { readCloudflareEnvVar } from "@/lib/cloudflareEnv";

function safeJsonForHtml(value: unknown) {
  // Prevent `</script>`-style breakouts.
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function pick(name: keyof PublicEnv) {
  const env =
    typeof process !== "undefined" && typeof process.env !== "undefined" ? process.env : undefined;
  const fromProcess = env?.[name];
  if (typeof fromProcess === "string" && fromProcess.trim()) {
    return fromProcess;
  }
  const fromCloudflare = readCloudflareEnvVar(String(name));
  if (typeof fromCloudflare === "string" && fromCloudflare.trim()) {
    return fromCloudflare;
  }
  return undefined;
}

export default function PublicEnvScript() {
  const env: PublicEnv = {
    NEXT_PUBLIC_SUPABASE_URL: pick("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: pick("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    NEXT_PUBLIC_API_BASE_URL: pick("NEXT_PUBLIC_API_BASE_URL"),
    NEXT_PUBLIC_SITE_URL: pick("NEXT_PUBLIC_SITE_URL")
  };

  return (
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `window.__PUBLIC_ENV__=${safeJsonForHtml(env)};`
      }}
    />
  );
}


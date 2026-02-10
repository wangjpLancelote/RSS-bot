import { readPublicEnv } from "@/lib/publicEnv";
import { readCloudflareEnvVar } from "@/lib/cloudflareEnv";

export function getSiteUrl() {
  const raw =
    readPublicEnv().NEXT_PUBLIC_SITE_URL?.trim() || readCloudflareEnvVar("NEXT_PUBLIC_SITE_URL")?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      return null;
    }
  }

  if (typeof process === "undefined" || process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  return null;
}


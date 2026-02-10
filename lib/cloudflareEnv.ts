import { getCloudflareContext } from "@opennextjs/cloudflare";

export function readCloudflareEnvVar(name: string): string | undefined {
  try {
    const ctx = getCloudflareContext();
    const value = (ctx?.env as Record<string, unknown> | undefined)?.[name];
    return typeof value === "string" ? value : undefined;
  } catch {
    // Not running on Cloudflare/OpenNext runtime (e.g. `next dev`).
    return undefined;
  }
}


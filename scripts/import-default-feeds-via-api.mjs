import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

// Built-in defaults (kept in code so we can remove the old rss/default-feeds.json file).
const BUILTIN_DEFAULT_FEEDS = [
  { url: "https://techcrunch.com/feed/", title: "TechCrunch", description: "Startup and technology news." },
  { url: "https://www.wired.com/feed/rss", title: "WIRED", description: "Technology, science, and culture news." },
  { url: "https://cointelegraph.com/rss", title: "Cointelegraph", description: "Cryptocurrency and blockchain news." },
  { url: "https://cryptopotato.com/feed/", title: "CryptoPotato", description: "Crypto market updates and guides." },
  { url: "https://www.smashingmagazine.com/feed/", title: "Smashing Magazine", description: "Web design and development articles." },
  { url: "https://gizmodo.com/rss", title: "Gizmodo", description: "Technology, science, and gadget news." },
  { url: "https://blog.myfitnesspal.com/feed/", title: "MyFitnessPal Blog", description: "Nutrition, fitness, and wellness tips." }
];

const defaultsPath = process.env.DEFAULT_FEEDS_FILE
  ? path.resolve(process.env.DEFAULT_FEEDS_FILE)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../rss/default-feeds.json");

function authHeaders(token, extra = {}) {
  return {
    ...extra,
    Authorization: `Bearer ${token}`
  };
}

async function request(token, pathname, options = {}) {
  const res = await fetch(`${apiBase}${pathname}`, {
    ...options,
    headers: authHeaders(token, options.headers || {})
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function loadDefaultFeeds() {
  if (process.env.DEFAULT_FEEDS_FILE) {
    const raw = await readFile(defaultsPath, "utf-8");
    const json = JSON.parse(raw);
    if (!Array.isArray(json)) {
      throw new Error("default feeds JSON must be an array");
    }
    return json;
  }

  try {
    const raw = await readFile(defaultsPath, "utf-8");
    const json = JSON.parse(raw);
    if (Array.isArray(json)) {
      return json;
    }
  } catch (_err) {
    // fall back to built-in list
  }

  return BUILTIN_DEFAULT_FEEDS;
}

async function resolveAuthToken() {
  const directToken = process.env.IMPORT_AUTH_TOKEN || process.env.TEST_AUTH_TOKEN;
  if (directToken) {
    return directToken;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!supabaseUrl || !supabaseAnonKey || !email || !password) {
    throw new Error(
      "Missing auth token and login fallback variables. Set IMPORT_AUTH_TOKEN (or TEST_AUTH_TOKEN), " +
        "or provide NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY + TEST_USER_EMAIL + TEST_USER_PASSWORD."
    );
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    throw new Error(error?.message || "Failed to sign in and get access token");
  }

  return data.session.access_token;
}

async function run() {
  console.log(`[import-default-feeds] API base: ${apiBase}`);
  console.log(
    `[import-default-feeds] Source: ${
      process.env.DEFAULT_FEEDS_FILE ? defaultsPath : "builtin (or legacy rss/default-feeds.json if present)"
    }`
  );
  const authToken = await resolveAuthToken();

  const health = await request(authToken, "/health");
  if (!health.res.ok) {
    console.error("[import-default-feeds] Health check failed.", health.data);
    process.exit(1);
  }

  const feeds = await loadDefaultFeeds();
  const validFeeds = feeds.filter((feed) => typeof feed?.url === "string" && feed.url.trim());

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const feed of validFeeds) {
    const url = feed.url.trim();
    const result = await request(authToken, "/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, autoFetch: false })
    });

    if (result.res.ok) {
      created += 1;
      console.log(`[created] ${url}`);
      continue;
    }

    if (result.res.status === 409) {
      skipped += 1;
      console.log(`[skipped] ${url} (already exists)`);
      continue;
    }

    failed += 1;
    console.error(`[failed] ${url}`, result.data);
  }

  console.log(
    `[import-default-feeds] done. total=${validFeeds.length}, created=${created}, skipped=${skipped}, failed=${failed}`
  );

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("[import-default-feeds] unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});

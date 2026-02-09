import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isNetworkFailure(message = "") {
  const m = message.toLowerCase();
  return m.includes("fetch failed") || m.includes("enotfound") || m.includes("econnrefused") || m.includes("timeout");
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  fail("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const startedAt = Date.now();

try {
  const { data, error, status } = await client.from("feeds").select("id,url,created_at").limit(1);
  const elapsedMs = Date.now() - startedAt;

  if (error) {
    const result = {
      ok: false,
      phase: "query",
      status,
      error: error.message,
      elapsedMs,
      conclusion:
        "不可行：当前环境下 SupabaseClient 无法正常查询 feeds。优先排查本地 server 到 Supabase 的网络或配置问题。"
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(2);
  }

  const result = {
    ok: true,
    phase: "query",
    status,
    rows: Array.isArray(data) ? data.length : 0,
    elapsedMs,
    conclusion:
      "可行：当前环境下 SupabaseClient 可以查询 feeds。问题更可能在前端访问后端链路（地址/CORS/服务启动状态）。"
  };
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  const result = {
    ok: false,
    phase: "transport",
    error: message,
    networkFailure: isNetworkFailure(message),
    conclusion:
      "不可行：当前环境下 SupabaseClient 查询失败。属于本地 server 到 Supabase 的访问问题（网络/DNS/代理）或关键配置异常。"
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(3);
}

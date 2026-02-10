try {
  await import("dotenv/config");
} catch {
  // Dependencies may not be installed yet (e.g. before npm install).
}

const specs = [
  {
    key: "SUPABASE_URL",
    required: true,
    requiredIn: "backend + rss fetcher",
    purpose: "Supabase 项目 URL。"
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    requiredIn: "backend + rss fetcher",
    purpose: "服务端写库权限 key（严禁前端暴露）。"
  },
  {
    key: "SUPABASE_ANON_KEY",
    required: false,
    requiredIn: "backend auth fallback",
    purpose: "后端校验用户 token 时可使用。"
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    requiredIn: "frontend",
    purpose: "前端 Supabase URL。"
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    requiredIn: "frontend + backend auth fallback",
    purpose: "前端 anon key；后端也可回退使用。"
  },
  {
    key: "NEXT_PUBLIC_API_BASE_URL",
    required: true,
    requiredIn: "frontend",
    purpose: "前端请求后端 API 的基础地址。"
  },
  {
    key: "PORT",
    required: false,
    requiredIn: "backend",
    purpose: "后端端口，默认 4000。"
  },
  {
    key: "ALLOWED_ORIGIN",
    required: false,
    requiredIn: "backend",
    purpose: "后端 CORS 白名单，默认建议本地 http://localhost:3000。"
  },
  {
    key: "CRON_SECRET",
    required: false,
    requiredIn: "cron endpoint",
    purpose: "保护 /cron/refresh 的 header secret。"
  },
  {
    key: "RSS_LLM_ADAPTER_PATH",
    required: false,
    requiredIn: "optional LLM extension",
    purpose: "可插拔 LLM 适配器模块路径（未配置则使用启发式）。"
  },
  {
    key: "INTAKE_MAX_CONVERSION_MS",
    required: false,
    requiredIn: "AI feed intake + semantic dedupe",
    purpose: "单次转换超时预算（毫秒）。"
  },
  {
    key: "INTAKE_FETCH_TIMEOUT_MS",
    required: false,
    requiredIn: "AI feed intake + semantic dedupe",
    purpose: "单页面抓取/渲染超时预算（毫秒）。"
  }
];

const missing = [];
const invalid = [];
const warnings = [];

for (const spec of specs) {
  const value = process.env[spec.key];
  if (spec.required && !value) {
    missing.push(spec);
  }
  if (typeof value === "string" && value !== value.trim()) {
    warnings.push(`${spec.key} has leading/trailing whitespace; it should be trimmed`);
  }
}

if (!process.env.SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  missing.push({
    key: "SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    requiredIn: "backend auth",
    purpose: "后端校验用户 token 至少需要一个 anon key。"
  });
}

if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.startsWith("sb_secret_")) {
  invalid.push({
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    reason: "must not use sb_secret_* in browser-exposed env"
  });
}

if (process.env.SUPABASE_ANON_KEY?.startsWith("sb_secret_")) {
  invalid.push({
    key: "SUPABASE_ANON_KEY",
    reason: "must be anon/public or publishable key, not sb_secret_*"
  });
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith("sb_publishable_")) {
  invalid.push({
    key: "SUPABASE_SERVICE_ROLE_KEY",
    reason: "must be service role secret key, not sb_publishable_*"
  });
}

if (missing.length > 0) {
  console.error("Env check failed. Missing required variables:");
  for (const item of missing) {
    console.error(`- ${item.key}: ${item.purpose} (required in ${item.requiredIn})`);
  }
  console.error("\nAction: copy .env.example to .env and fill required values.");
  process.exit(1);
}

if (invalid.length > 0) {
  console.error("Env check failed. Invalid key types:");
  for (const item of invalid) {
    console.error(`- ${item.key}: ${item.reason}`);
  }
  process.exit(1);
}

if (!process.env.CRON_SECRET) {
  console.warn("Warning: CRON_SECRET is empty. /cron/refresh will be callable without secret.");
}

if (!process.env.RSS_LLM_ADAPTER_PATH) {
  console.warn("Warning: RSS_LLM_ADAPTER_PATH is empty. LLM behavior will stay in heuristic mode.");
}

if (process.env.ALLOWED_ORIGIN === "*") {
  console.warn("Warning: ALLOWED_ORIGIN is '*'. Do not use this in production.");
}

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  console.warn(
    "Warning: NODE_TLS_REJECT_UNAUTHORIZED=0 — TLS cert verification disabled (corporate proxy mode). Do not use in production."
  );
}

for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
}

console.log("Env check passed.");

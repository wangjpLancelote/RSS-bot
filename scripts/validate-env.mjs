try {
  await import("dotenv/config");
} catch (_err) {
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
  }
];

const missing = [];

for (const spec of specs) {
  if (spec.required && !process.env[spec.key]) {
    missing.push(spec);
  }
}

if (!process.env.SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  missing.push({
    key: "SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    requiredIn: "backend auth",
    purpose: "后端校验用户 token 至少需要一个 anon key。"
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

if (!process.env.CRON_SECRET) {
  console.warn("Warning: CRON_SECRET is empty. /cron/refresh will be callable without secret.");
}

if (process.env.ALLOWED_ORIGIN === "*") {
  console.warn("Warning: ALLOWED_ORIGIN is '*'. Do not use this in production.");
}

console.log("Env check passed.");

# 部署说明

## 前端（Cloudflare Pages）

### 部署方式
- 使用 Cloudflare Pages 部署静态站点。
- 如果需要静态导出，请在 `next.config.ts` 中设置：

```ts
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true }
};
```

### 构建与输出
- Build Command（示例）：
  - `npm install && npm run build`
- Output Directory：
  - `out`

### 需要的环境变量
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`（指向 Render 后端 URL）

## 后端（Render）

### 服务类型
- Web Service
- Root Directory：`server/`

### 构建/启动命令
- Build Command：
  - `npm install && npm run build`
- Start Command：
  - `npm run start`

### 需要的环境变量
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `ALLOWED_ORIGIN`（Cloudflare Pages 的域名）
- `CRON_SECRET`（可选，用于 `/cron/refresh`）
- `PORT=4000`

## 数据库（Supabase）

### 确认表与 RLS
- 执行 `supabase/schema.sql`
- 如果启用 Auth：
  - `supabase/auth_schema.sql`
  - `supabase/rls-auth.sql`

## CORS / 域名联动
- `ALLOWED_ORIGIN` 设置为你的 Cloudflare Pages 域名
- `NEXT_PUBLIC_API_BASE_URL` 设置为 Render 后端 URL

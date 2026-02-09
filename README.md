# RSS Reader MVP

Next.js + Express + Supabase 的 RSS 订阅管理与阅读工具（带登录鉴权）。

## 项目结构
- `app/`: 前端（Next.js App Router）
- `server/`: 后端（Node.js + Express）
- `supabase/`: 数据库 schema 与 RLS SQL
- `rss/`: GitHub Actions RSS 拉取脚本
- `scripts/`: 校验、初始化与 smoke 脚本
- `supabase/functions/`: Edge Functions（login/logout）
- `tests/`: 单元测试

## 从 0 到可用（推荐流程）

### 1) 一键初始化
```bash
npm run setup
```

`setup` 会执行：
1. `npm install`
2. 自动创建 `.env`（若不存在，复制自 `.env.example`）
3. 输出数据库初始化顺序
4. 执行 `npm run validate`

### 2) 初始化 Supabase（Auth 模式）
请按以下顺序执行 SQL（顺序固定）：
1. `supabase/schema.sql`
2. `supabase/auth_schema.sql`
3. `supabase/rls-auth.sql`

可先查看顺序提示：
```bash
npm run db:init:auth
```

注意：
- `supabase/rls.sql` 是匿名模式策略；
- 启用登录鉴权时，不要和 `supabase/rls-auth.sql` 混用。

### 3) 启动开发环境
```bash
npm run dev:all
```
默认端口：
- 前端（Next.js）：`http://localhost:3000`
- 后端（Express）：`http://localhost:4000`

### 4) 最小验收
按顺序执行：
```bash
npm run validate
npm run dev:all
npm run smoke
```

## 环境变量说明

参考文件：`.env.example`

- `SUPABASE_URL`: 必填，后端与 RSS 抓取使用
- `SUPABASE_SERVICE_ROLE_KEY`: 必填，后端写库权限（必须是 `sb_secret_*`）
- `SUPABASE_ANON_KEY`: 必填，Edge Functions 使用（必须是 anon/public 或 `sb_publishable_*`，不能是 `sb_secret_*`）
- `NEXT_PUBLIC_SUPABASE_URL`: 必填，前端 Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 必填，前端 anon/public 或 `sb_publishable_*`（不能是 `sb_secret_*`）
- `NEXT_PUBLIC_API_BASE_URL`: 必填，前端请求后端 API 地址（本地默认 `http://localhost:4000`）
- `PORT`: 可选，后端端口（默认 `4000`）
- `ALLOWED_ORIGIN`: 推荐必填，支持逗号分隔多个来源（如 `http://localhost:3000,http://127.0.0.1:3000`），生产环境不要使用 `*`
- `CRON_SECRET`: 强烈建议填写，用于保护 `/cron/refresh`

## Smoke 测试参数

`npm run smoke` 依赖以下可选变量：
- `TEST_AUTH_TOKEN`: 用户登录后的 access token（不填则跳过鉴权检查）
- `TEST_FEED_URL`: 用于创建/刷新的测试 RSS 地址（不填则跳过创建刷新检查）

建议流程：
1. 先在 `/login` 注册并登录一个测试用户；
2. 从浏览器网络请求或 Supabase SDK 会话里取 `access_token`；
3. 设置环境变量后执行 `npm run smoke`。

## RSS 自动拉取（GitHub Actions）
- 工作流：`.github/workflows/rss.yml`
- Secrets：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`
- 逻辑入口：`rss/fetch.js`
- 默认触发：每 30 分钟 + push + 手动触发
- 默认订阅源：`rss/default-feeds.json`（首次执行自动写入 `feeds` 表）

## Supabase Edge Functions
- `supabase/functions/login`：登录（email/password）
- `supabase/functions/logout`：登出（需 Bearer token）

## 单元测试（登录/登出）
- 测试文件：`tests/auth.test.mjs`
- 依赖环境变量：
  - `TEST_USER_EMAIL`（默认：`lorenzo.wang@lifebyte.io`）
  - `TEST_USER_PASSWORD`（必填）

运行：
```bash
TEST_USER_PASSWORD=*** npm test
```

## 部署
- 前端：Cloudflare Pages（静态部署）
- 后端：Render Web Service（Root Directory = `server/`）
- 数据库：Supabase

详见 `docs/deploy.md`

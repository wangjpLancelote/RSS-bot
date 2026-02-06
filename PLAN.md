# RSS Reader MVP Plan (Separated Frontend/Backend + Auth)

## Summary
- Web 端 RSS 阅读器，支持订阅管理、手动/自动更新、Markdown 阅读与实时状态。
- 前端：Next.js（仅客户端交互）
- 后端：Node.js + Express（独立目录 `server/`）
- Auth：Supabase Auth（邮箱+密码）

## Scope
- In: 订阅管理（新增/编辑/删除）、手动更新、自动更新、阅读列表与详情（MD）、状态实时显示、登录鉴权。
- Out: 移动端 App、收藏/推荐、全文搜索、OPML 导入导出。

## Architecture
- Frontend: Next.js App Router（客户端）
- Backend: Express API（Token 校验）
- Database: Supabase Postgres + Realtime
- 自动更新：`POST /cron/refresh`（可配 `CRON_SECRET`）

## Data Model
- `feeds` 增加 `user_id` 归属
- `feed_items`、`fetch_runs` 通过 `feeds.user_id` 做 RLS

SQL：
- `supabase/schema.sql`
- `supabase/auth_schema.sql`
- `supabase/rls-auth.sql`

## Backend APIs
- `GET /feeds` (auth)
- `POST /feeds` (auth)
- `GET /feeds/:id` (auth)
- `PATCH /feeds/:id` (auth)
- `DELETE /feeds/:id` (auth)
- `GET /feeds/:id/items` (auth)
- `GET /items/:id` (auth)
- `POST /feeds/:id/refresh` (auth)
- `POST /refresh` (auth)
- `POST /cron/refresh` (optional secret)

## Realtime
- 前端使用 Supabase Realtime 订阅 `feeds` 表变更。

## Markdown Rendering
- 前端使用 `turndown` 将 HTML 转 Markdown，使用 `react-markdown` 渲染。

## Auth Flow
- 前端 `/login` 进行注册/登录
- 前端调用后端时带 `Authorization: Bearer <token>`
- 后端验证 token 后执行业务逻辑

## Assumptions
- 启用 Supabase Auth。
- 生产环境需更严格的 RLS 和 CORS 设置。

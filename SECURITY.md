# Security Notes

## Auth Overview
- 前端使用 Supabase Auth（邮箱+密码）。
- 前端每次调用服务端 API 时，携带 `Authorization: Bearer <access_token>`。
- 服务端通过 Supabase Auth 校验 token 并识别用户。

## Environment Variables
- `SUPABASE_SERVICE_ROLE_KEY` 仅用于服务端，切勿暴露到前端或客户端环境。
- `SUPABASE_ANON_KEY` 或 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 用于服务端校验用户 token。
- `NEXT_PUBLIC_*` 仅用于前端，可公开。

## RLS (Row Level Security)
- 认证模式下请执行：
  - `supabase/auth_schema.sql`
  - `supabase/rls-auth.sql`
- 旧的 `supabase/rls.sql` 为匿名开放策略，仅用于无 Auth 的 MVP。

## Cron 安全
- `/cron/refresh` 支持 `CRON_SECRET` 校验。
- 设置后，调用方需携带 header `x-cron-secret`。

# Tasks

1. 拆分服务端结构
- 新增 `server/src` 目录与模块化结构
- 拆分 routes / services / middleware / utils

2. 加入 Auth
- 前端新增 `/login`
- 前端调用后端时携带 Bearer token
- 后端校验 token 并注入用户上下文

3. 数据库调整与 RLS
- `feeds` 增加 `user_id`
- 执行 `supabase/auth_schema.sql`
- 执行 `supabase/rls-auth.sql`

4. API 调整
- 所有业务 API 需要 auth
- Cron 接口可选 secret

5. UI 优化
- 登录状态显示
- 未登录引导
- 操作 busy 状态

6. 验证与测试
- `npm run validate`
- `npm run smoke`

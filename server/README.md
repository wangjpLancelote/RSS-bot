# RSS Reader Server

独立 Node.js 服务端（Express），负责 RSS 订阅、抓取与入库。

## 运行

1. 配置环境变量（参考根目录 `.env.example`，包含 `SUPABASE_ANON_KEY`）
2. 确保已创建 Supabase Auth 用户（前端 `/login` 注册）
3. 启动开发模式：

```bash
npm run dev:server
```

生产构建：

```bash
npm run build:server
npm run start:server
```

## 端口与跨域
- 默认端口：`4000`
- 允许跨域来源：`ALLOWED_ORIGIN`，示例 `http://localhost:3000`

## API 入口
- `GET /health`
- `GET /feeds` (requires auth)
- `POST /feeds` (requires auth)
- `PATCH /feeds/:id` (requires auth)
- `DELETE /feeds/:id` (requires auth)
- `GET /feeds/:id` (requires auth)
- `GET /feeds/:id/items` (requires auth)
- `GET /items/:id` (requires auth)
- `POST /feeds/:id/refresh` (requires auth)
- `POST /refresh` (requires auth)
- `POST /cron/refresh` (optional secret)

## Cron
- `/cron/refresh` 可配置 `CRON_SECRET` 校验
- 可用外部 Cron 服务定时触发

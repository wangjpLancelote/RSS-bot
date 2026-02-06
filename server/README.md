# RSS Reader Server

Node.js (Express) 服务端，用于 RSS 订阅管理、抓取与入库。

## 本地开发

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

## RSS 定时拉取（GitHub Actions）
- 工作流文件：`.github/workflows/rss.yml`
- 依赖 Secrets：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`
- 默认每 30 分钟触发一次，可在 workflow 中调整

## 端口与跨域
- 默认端口：`4000`
- 允许跨域来源：`ALLOWED_ORIGIN`

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

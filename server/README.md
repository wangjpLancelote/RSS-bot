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

## 部署
### Railway（推荐）
1. 在 Railway 中连接仓库后，创建服务并将 Root Directory 设为 `server/`
2. 配置 Config File Path 为 `/railway.json`（根目录部署入口配置）
3. 配置环境变量：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `ALLOWED_ORIGIN`
   - `CRON_SECRET`（可选）
4. 部署后访问 `GET /health` 验证健康状态

说明：
- `server/Dockerfile` 使用 `npm run build` + `npm start` 启动服务。
- Root Directory=`server/` 时，`railway.json` 中 `dockerfilePath=Dockerfile` 会指向 `server/Dockerfile`。
- Railway 会自动注入 `PORT`，本地未设置时默认回退到 `4000`。

详细步骤参考 `docs/deploy.md`。

## 端口与跨域
- 默认端口：`4000`
- 允许跨域来源：`ALLOWED_ORIGIN`

## API 入口
- `GET /health`
- `GET /health/auth`
- `GET /feeds` (requires auth)
- `POST /feeds` (requires auth)
- `POST /feeds/intake` (requires auth)
- `GET /feeds/intake/:jobId` (requires auth)
- `PATCH /feeds/:id` (requires auth)
- `DELETE /feeds/:id` (requires auth)
- `GET /feeds/:id` (requires auth)
- `GET /feeds/:id/items` (requires auth)
- `GET /items/:id` (requires auth)
- `POST /feeds/:id/refresh` (requires auth)
- `POST /refresh` (requires auth)
- `POST /cron/refresh` (optional secret)

## 服务层链路文档
- `server/src/services/README.md`

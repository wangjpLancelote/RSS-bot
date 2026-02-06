# RSS Reader Server (Fly.io)

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

## Fly.io 部署

### 1. 准备
- 安装 `flyctl`
- `flyctl auth login`

### 2. 初始化（一次性）
在仓库根目录执行：

```bash
fly launch --no-deploy --config server/fly.toml
```

填入你的 App 名称与 Region，然后更新 `server/fly.toml`：

```toml
app = "YOUR_APP_NAME"
primary_region = "YOUR_REGION"
```

### 3. 设置 Secrets

```bash
fly secrets set \
  SUPABASE_URL=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  SUPABASE_ANON_KEY=... \
  CRON_SECRET=... \
  ALLOWED_ORIGIN=https://<your-frontend-domain>
```

### 4. 部署

```bash
fly deploy -c server/fly.toml
```

### 5. Cron（UTC 00:00）
已内置 `supercronic`，通过 `server/crontab` 每日 00:00 UTC 调用：

```
POST http://127.0.0.1:4000/cron/refresh
```

如果需修改频率，调整 `server/crontab` 即可。

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

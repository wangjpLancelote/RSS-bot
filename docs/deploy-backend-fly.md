# Fly.io 部署指南（Backend）

## 目标
将 `server/` 目录的 Node.js RSS Backend 部署到 Fly.io，并使用内置 cron 每日 UTC 00:00 自动刷新。

## 依赖
- 安装 `flyctl`
- Fly.io 账号并登录：`flyctl auth login`

## 一次性初始化
在仓库根目录执行：

```bash
fly launch --no-deploy --config server/fly.toml
```

然后编辑 `server/fly.toml`：

```toml
app = "YOUR_APP_NAME"
primary_region = "YOUR_REGION"
```

## 配置 Secrets

```bash
fly secrets set \
  SUPABASE_URL=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  SUPABASE_ANON_KEY=... \
  CRON_SECRET=... \
  ALLOWED_ORIGIN=https://<your-frontend-domain>
```

## 部署

```bash
fly deploy -c server/fly.toml
```

## Cron
`server/crontab` 定义每日 UTC 00:00 调用：

```
POST http://127.0.0.1:4000/cron/refresh
```

修改频率可直接编辑该文件。

## 健康检查

```bash
curl https://<your-fly-app>.fly.dev/health
```

# RSS Reader MVP

## 项目结构
- `app/` 前端（Next.js）
- `server/` 后端（Node.js + Express）
- `rss/` GitHub Actions RSS 拉取脚本

## 本地开发

```bash
npm install
npm run dev:all
```

## RSS 自动拉取
- 工作流：`.github/workflows/rss.yml`
- Secrets：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`
- 逻辑入口：`rss/fetch.js`
- 自动触发：每次 push + 每 30 分钟定时

## 生产部署
前端与后端部署方式不在本次修改范围内。

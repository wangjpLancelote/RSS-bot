# RSS Reader MVP

## 项目结构
- `app/` 前端（Next.js）
- `server/` 后端（Node.js + Express）

## 本地开发

```bash
npm install
npm run dev:server
npm run dev
```

## 生产部署

### Backend (Fly.io)
- 参见 `docs/deploy-backend-fly.md`
- GitHub Actions: `.github/workflows/deploy-backend-fly.yml`

### Frontend
前端保持现有部署方式，不在本次修改范围内。

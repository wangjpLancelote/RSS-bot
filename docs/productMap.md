# RSS-Bot ProductMap (Pixel Style)

> 目标：覆盖 RSS 订阅从前端提交、Node 处理、Supabase 落库，到前端展示的完整链路，并标注对应文件。

## Pixel Flow

```mermaid
flowchart LR
  %% Pixel UI flavor via thick border + monospace
  classDef px fill:#fef3c7,stroke:#111827,stroke-width:3px,color:#111827;
  classDef fe fill:#dbeafe,stroke:#1e3a8a,stroke-width:3px,color:#0f172a;
  classDef api fill:#dcfce7,stroke:#14532d,stroke-width:3px,color:#052e16;
  classDef svc fill:#fee2e2,stroke:#7f1d1d,stroke-width:3px,color:#450a0a;
  classDef db fill:#e9d5ff,stroke:#581c87,stroke-width:3px,color:#3b0764;

  subgraph FE["[PIXEL] FRONTEND (Next.js)"]
    F1["新增订阅页\napp/(main)/feeds/new/page.tsx"]:::fe
    F2["FeedForm 提交 + 轮询进度\ncomponents/FeedForm.tsx"]:::fe
    F3["主页拉取订阅 + Realtime\napp/(main)/page.tsx\ncomponents/FeedList.tsx"]:::fe
    F4["详情页拉取 feed/items + 正文净化展示\napp/(main)/feeds/[id]/page.tsx"]:::fe
    F5["手动刷新按钮\ncomponents/FeedDetailActions.tsx"]:::fe
  end

  subgraph API["[PIXEL] NODE ROUTES (Express)"]
    A0["路由注册\nserver/src/routes/index.ts"]:::api
    A1["POST /feeds/intake\nserver/src/routes/feeds-intake.ts"]:::api
    A2["GET /feeds/intake/:jobId\nserver/src/routes/feeds-intake.ts"]:::api
    A3["GET /feeds | GET /feeds/:id/items\nserver/src/routes/feeds.ts"]:::api
    A4["POST /feeds/:id/refresh\nserver/src/routes/feeds.ts"]:::api
    A5["POST /refresh\nserver/src/routes/refresh.ts"]:::api
    A6["POST /cron/refresh\nserver/src/routes/cron.ts"]:::api
  end

  subgraph SVC["[PIXEL] SERVICE LAYER"]
    S1["enqueueFeedIntake\nserver/src/services/feedIntake.ts"]:::svc
    S2["processFeedIntakeJob\nserver/src/services/feedIntake.ts"]:::svc
    S3["discoverFeedUrl\nserver/src/services/discovery.ts"]:::svc
    S4["runLangGraphConversion\nserver/src/services/langgraphPipeline.ts"]:::svc
    S5["createRssFeed / createWebMonitorFeed\nserver/src/services/feedIntake.ts"]:::svc
    S6["fetchAndStoreByType\nserver/src/services/rss.ts"]:::svc
    S7["fetchAndStoreRssFeed\nserver/src/services/rss.ts"]:::svc
    S8["fetchAndStoreWebMonitorFeed\nserver/src/services/rss.ts"]:::svc
    S9["contentCleaner 正文提纯\nserver/src/services/contentCleaner.ts"]:::svc
  end

  subgraph DB["[PIXEL] SUPABASE TABLES"]
    D1["feed_intake_jobs\nstatus/stage/progress"]:::db
    D2["feeds\nsource_type/status/extraction_rule"]:::db
    D3["feed_items\ncontent_html/content_text"]:::db
    D4["web_snapshots\ncandidate_key/content_hash/llm_decision"]:::db
    D5["fetch_runs\nstarted_at/finished_at/items_added"]:::db
    D6["feed_events\nadd/remove"]:::db
  end

  %% Intake path
  F1 --> F2
  F2 -->|"POST /feeds/intake"| A1
  A1 --> S1 --> D1
  D1 --> S2
  S2 --> S3
  S3 -->|"RSS 命中"| S5
  S3 -->|"RSS 未命中"| S4 --> S9 --> S5
  S5 -->|"insert"| D2
  S5 -->|"web_monitor upsert"| D3
  S5 -->|"web_monitor upsert"| D4
  S5 -->|"log add"| D6
  S5 -->|"update done"| D1
  S5 -->|"首次拉取"| S6
  S6 -->|"rss"| S7 --> S9
  S6 -->|"web_monitor"| S8 --> S9
  S7 -->|"upsert"| D3
  S7 -->|"update"| D2
  S7 -->|"insert"| D5
  S8 -->|"upsert new"| D3
  S8 -->|"upsert all decisions"| D4
  S8 -->|"update"| D2
  S8 -->|"insert"| D5
  F2 -->|"poll job"| A2 --> D1

  %% Display + refresh path
  F3 -->|"GET /feeds"| A3 --> D2
  F4 -->|"GET /feeds/:id/items"| A3 --> D3
  F5 -->|"POST /feeds/:id/refresh"| A4 --> S6
  F3 -->|"刷新全部"| A5 --> S6
  A6 --> S6
  D2 -. realtime postgres_changes .-> F3

  A0 --- A1
  A0 --- A3
  A0 --- A5
  A0 --- A6
```

## File Index (Step -> File)

1. 前端新增订阅入口  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/app/(main)/feeds/new/page.tsx`
2. 前端提交与任务轮询（detecting/converting/validating/creating）  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/components/FeedForm.tsx`
3. 路由入口与鉴权挂载  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/server/src/routes/index.ts`  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/server/src/middleware/auth.ts`
4. Intake API（创建任务、查询任务）  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/server/src/routes/feeds-intake.ts`
5. Intake 任务执行主链（RSS 发现 -> 回退网页转换 -> 创建 feed）  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/server/src/services/feedIntake.ts`  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/server/src/services/discovery.ts`  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/server/src/services/langgraphPipeline.ts`
6. 刷新链路（单 feed / 批量 / cron）  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/server/src/routes/feeds.ts`  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/server/src/routes/refresh.ts`  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/server/src/routes/cron.ts`  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/server/src/services/rss.ts`
7. 正文提纯（评论/点赞/登录等噪音剥离）  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/server/src/services/contentCleaner.ts`  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/app/(main)/feeds/[id]/page.tsx`
8. 前端展示（列表、详情、手动刷新）  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/app/(main)/page.tsx`  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/components/FeedList.tsx`  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/components/FeedDetailActions.tsx`  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/app/(main)/feeds/[id]/page.tsx`
9. Supabase 数据结构定义  
   `/Users/lorenzo.wang/LifeByte/RSS-bot/supabase/schema.sql`

## Supabase 落库点速查

1. `feed_intake_jobs`：创建 intake 任务、更新进度、写入结果/错误。  
2. `feeds`：创建订阅源、更新状态（`idle/fetching/ok/error`）、更新 `source_type` 与抽取规则。  
3. `feed_items`：RSS 条目或 web_monitor 新候选内容入库（正文净化后）。  
4. `web_snapshots`：web_monitor 的内容哈希快照与语义决策（`new/minor_update/noise`）。  
5. `fetch_runs`：每次刷新批次的开始、结束、结果统计。  
6. `feed_events`：订阅新增/删除操作审计。


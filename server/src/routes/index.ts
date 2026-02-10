import type { Express } from "express";
import feedsRouter from "./feeds";
import itemsRouter from "./items";
import refreshRouter from "./refresh";
import cronRouter from "./cron";
import healthRouter from "./health";
import feedsIntakeRouter from "./feeds-intake";
import { requireAuth } from "../middleware/auth";

export function registerRoutes(app: Express) {
  app.use("/health", healthRouter);
  app.use("/cron", cronRouter);
  app.use("/feeds/intake", requireAuth, feedsIntakeRouter);
  app.use("/feeds", requireAuth, feedsRouter);
  app.use("/items", requireAuth, itemsRouter);
  app.use("/refresh", requireAuth, refreshRouter);
}

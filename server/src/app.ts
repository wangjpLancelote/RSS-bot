import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes";

const app = express();

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    allowedHeaders: ["Content-Type", "Authorization", "x-cron-secret"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
  })
);
app.use(express.json({ limit: "1mb" }));

registerRoutes(app);

export default app;

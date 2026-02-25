import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes";

const app = express();

const normalizeOrigin = (value: string): string =>
  value.trim().replace(/\/+$/, "").toLowerCase();

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:3000,http://127.0.0.1:3000";
const allowedOrigins = ALLOWED_ORIGIN.split(",")
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);
const allowAllOrigins = allowedOrigins.includes("*");

console.log("[cors] ALLOWED_ORIGIN:", JSON.stringify(allowedOrigins));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (allowAllOrigins || allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      console.warn(`[cors] Blocked origin: ${origin}`);
      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-cron-secret"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
  })
);
app.use(express.json({ limit: "1mb" }));

registerRoutes(app);

export default app;

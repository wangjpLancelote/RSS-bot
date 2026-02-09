import "dotenv/config";
import app from "./app";

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  console.warn(
    "[tls] NODE_TLS_REJECT_UNAUTHORIZED=0 — TLS certificate verification is DISABLED. " +
      "This is expected behind a corporate proxy but must NOT be used in production."
  );
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  if (!process.env.CRON_SECRET) {
    console.warn("[cron] CRON_SECRET is empty. /cron/refresh is not protected.");
  }
  console.log(
    `RSS server running on port ${PORT} (mode=${process.env.NODE_ENV || "development"}, entry=${process.argv[1]})`
  );
});

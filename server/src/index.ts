import "dotenv/config";
import app from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  if (!process.env.CRON_SECRET) {
    console.warn("[cron] CRON_SECRET is empty. /cron/refresh is not protected.");
  }
  console.log(`RSS server running on port ${PORT}`);
});

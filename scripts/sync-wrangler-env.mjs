import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const cwd = process.cwd();
const sourcePath = path.join(cwd, ".env");
const outputs = [path.join(cwd, ".dev.vars"), path.join(cwd, ".env.wrangler")];

if (!fs.existsSync(sourcePath)) {
  console.error("[wrangler:env] Missing .env file");
  process.exit(1);
}

const parsed = dotenv.parse(fs.readFileSync(sourcePath, "utf8"));

const prefixAllowList = ["NEXT_PUBLIC_"];
const includeAllowList = new Set(
  (process.env.WRANGLER_ENV_INCLUDE || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
);
const excludeList = new Set(
  (process.env.WRANGLER_ENV_EXCLUDE || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
);

const selected = Object.entries(parsed).filter(([key]) => {
  const allowedByPrefix = prefixAllowList.some((prefix) => key.startsWith(prefix));
  const allowedByName = includeAllowList.has(key);
  return (allowedByPrefix || allowedByName) && !excludeList.has(key);
});

if (selected.length === 0) {
  console.error("[wrangler:env] No variables selected from .env");
  process.exit(1);
}

const formatValue = (value) => {
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
};

const content = `${selected
  .map(([key, value]) => `${key}=${formatValue(value)}`)
  .join("\n")}\n`;

for (const outputPath of outputs) {
  fs.writeFileSync(outputPath, content, "utf8");
}

console.log(`[wrangler:env] Synced ${selected.length} vars to .dev.vars and .env.wrangler`);
console.log(`[wrangler:env] Keys: ${selected.map(([key]) => key).join(", ")}`);

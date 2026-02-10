import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const cwd = process.cwd();
const args = process.argv.slice(2);

const sourceArgIndex = args.findIndex((arg) => arg === "--source");
const sourceFile = sourceArgIndex >= 0 ? args[sourceArgIndex + 1] : ".env";
const outArgs = args
  .flatMap((arg, index) => (arg === "--out" ? [args[index + 1]] : []))
  .filter(Boolean);

const sourcePath = path.join(cwd, sourceFile);
const outputs =
  outArgs.length > 0 ? outArgs.map((output) => path.join(cwd, output)) : [path.join(cwd, ".dev.vars"), path.join(cwd, ".env.wrangler")];

if (!fs.existsSync(sourcePath)) {
  console.error(`[wrangler:env] Missing source env file: ${sourceFile}`);
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
  console.error(`[wrangler:env] No variables selected from ${sourceFile}`);
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

console.log(
  `[wrangler:env] Synced ${selected.length} vars from ${sourceFile} to ${outputs
    .map((outputPath) => path.basename(outputPath))
    .join(", ")}`
);
console.log(`[wrangler:env] Keys: ${selected.map(([key]) => key).join(", ")}`);

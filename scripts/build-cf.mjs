import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import dotenv from "dotenv";

const sourceFile = ".env.production";
const sourcePath = path.join(process.cwd(), sourceFile);

if (!fs.existsSync(sourcePath)) {
  console.error(`[build:cf] Missing source env file: ${sourceFile}`);
  process.exit(1);
}

const parsed = dotenv.parse(fs.readFileSync(sourcePath, "utf8"));
const buildEnv = {
  ...process.env,
  ...parsed,
  NODE_ENV: "production"
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function main() {
  console.log(`[build:cf] Building OpenNext with ${sourceFile}`);
  const localCli = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "opennextjs-cloudflare.cmd" : "opennextjs-cloudflare"
  );

  if (fs.existsSync(localCli)) {
    await run(localCli, ["build"], { env: buildEnv });
    return;
  }

  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  await run(npxCmd, ["@opennextjs/cloudflare@latest", "build"], { env: buildEnv });
}

main().catch((error) => {
  console.error(`[build:cf] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { printAuthSqlOrder, printAuthSqlPsqlTemplate } from "./supabase-auth-sql-order.mjs";

const root = process.cwd();
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const envPath = path.join(root, ".env");
const envExamplePath = path.join(root, ".env.example");

function runStep(title, cmd, args) {
  console.log(`\n[setup] ${title}`);
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("[setup] RSS Reader MVP setup started.");

runStep("Installing dependencies", npmCmd, ["install"]);

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log("[setup] .env not found. Created from .env.example, please fill secrets.");
}

console.log("\n[setup] Database initialization order (auth mode):");
printAuthSqlOrder("");
console.log("Note: supabase/rls.sql is anonymous MVP policy; do not mix with rls-auth.sql.");

console.log("\n[setup] Command template (run manually in your SQL tool):");
printAuthSqlPsqlTemplate("");

runStep("Validating environment", npmCmd, ["run", "validate"]);

console.log("\n[setup] Next steps:");
console.log("1) npm run dev:all");
console.log("2) npm run smoke");

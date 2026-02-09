import { printAuthSqlOrder } from "./supabase-auth-sql-order.mjs";

printAuthSqlOrder();
console.log("");
console.log("Do NOT run supabase/rls.sql together with auth mode.");
console.log("rls.sql is only for anonymous single-user MVP.");

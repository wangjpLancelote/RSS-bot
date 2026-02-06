console.log("Supabase auth-mode SQL initialization order:");
console.log("1. supabase/schema.sql");
console.log("2. supabase/auth_schema.sql");
console.log("3. supabase/rls-auth.sql");
console.log("");
console.log("Do NOT run supabase/rls.sql together with auth mode.");
console.log("rls.sql is only for anonymous single-user MVP.");

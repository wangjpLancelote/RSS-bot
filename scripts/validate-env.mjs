const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_API_BASE_URL"
];

const missing = required.filter((key) => !process.env[key]);
const authKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!authKey) {
  missing.push("SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

if (missing.length > 0) {
  console.error("Missing env vars:", missing.join(", "));
  process.exit(1);
}

console.log("Env check passed.");

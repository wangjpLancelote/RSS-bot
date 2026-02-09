export const AUTH_SQL_FILES = ["supabase/schema.sql", "supabase/auth_schema.sql", "supabase/rls-auth.sql"];

export function printAuthSqlOrder(title = "Supabase auth-mode SQL initialization order:") {
  if (title) {
    console.log(title);
  }
  AUTH_SQL_FILES.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
}

export function printAuthSqlPsqlTemplate(prefix = "Command template (run manually in your SQL tool):") {
  if (prefix) {
    console.log(prefix);
  }
  AUTH_SQL_FILES.forEach((file) => {
    console.log(`- psql \"$SUPABASE_DB_URL\" -f ${file}`);
  });
}

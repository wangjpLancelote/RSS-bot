import "dotenv/config";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || "lorenzo.wang@lifebyte.io";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("Missing SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

if (SUPABASE_ANON_KEY.startsWith("sb_secret_")) {
  throw new Error(
    "SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY cannot be sb_secret_*; use anon/public or publishable key"
  );
}

if (!TEST_USER_PASSWORD) {
  throw new Error("Missing TEST_USER_PASSWORD (set for login test)");
}

const base = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1`;
const authBase = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1`;

async function postJson(path, body, token) {
  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function getAuthUser(token) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`
  };

  const res = await fetch(`${authBase}/user`, {
    method: "GET",
    headers
  });

  const data = await res.json().catch(() => ({}));
  return { res, data };
}

describe("Supabase Edge Functions auth", () => {
  test("login returns session", async () => {
    const { res, data } = await postJson("/login", {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    assert.equal(res.status, 200, `login status ${res.status}`);
    assert.ok(data.session?.access_token, "missing access_token");
  });

  test("user endpoint returns profile", async () => {
    const login = await postJson("/login", {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    assert.equal(login.res.status, 200, `login status ${login.res.status}`);
    const accessToken = login.data.session?.access_token;
    assert.ok(accessToken, "missing access_token");

    const user = await getAuthUser(accessToken);
    assert.equal(user.res.status, 200, `user status ${user.res.status}`);
    assert.equal(user.data?.email, TEST_USER_EMAIL, "email mismatch");
    assert.ok(user.data?.id, "missing user id");
  });

  test("logout returns ok", async () => {
    const login = await postJson("/login", {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    assert.equal(login.res.status, 200, `login status ${login.res.status}`);
    const accessToken = login.data.session?.access_token;
    assert.ok(accessToken, "missing access_token");

    const logout = await postJson("/logout", {}, accessToken);
    assert.equal(logout.res.status, 200, `logout status ${logout.res.status}`);
    assert.equal(logout.data.ok, true, "logout ok false");
  });
});

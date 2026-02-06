const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
const testFeed = process.env.TEST_FEED_URL;
const authToken = process.env.TEST_AUTH_TOKEN;

console.log(`[smoke] API base: ${base}`);
console.log("[smoke] Optional env: TEST_AUTH_TOKEN, TEST_FEED_URL");

function withAuth(headers = {}) {
  if (!authToken) return headers;
  return { ...headers, Authorization: `Bearer ${authToken}` };
}

async function request(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: withAuth(options.headers || {})
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

(async () => {
  const health = await request("/health");
  if (!health.res.ok) {
    console.error("Health check failed", health.data);
    process.exit(1);
  }
  console.log("Health ok");

  if (!authToken) {
    console.log("TEST_AUTH_TOKEN not set. Skipping authenticated checks.");
    process.exit(0);
  }

  if (!testFeed) {
    console.log("TEST_FEED_URL not set. Skipping create/refresh checks.");
    process.exit(0);
  }

  const create = await request("/feeds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: testFeed, autoFetch: true })
  });

  if (!create.res.ok && create.res.status !== 409) {
    console.error("Create feed failed", create.data);
    process.exit(1);
  }

  const feedId = create.data.feed?.id;
  if (feedId) {
    const refresh = await request(`/feeds/${feedId}/refresh`, { method: "POST" });
    if (!refresh.res.ok) {
      console.error("Refresh failed", refresh.data);
      process.exit(1);
    }
  }

  console.log("Smoke test completed");
})();

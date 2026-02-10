import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverFeedUrl } from "../src/services/discovery";

test("discoverFeedUrl resolves alternate RSS link from html", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://example.com") {
        return new Response(
          '<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml" /></head><body>Hello</body></html>',
          {
            status: 200,
            headers: { "content-type": "text/html" }
          }
        );
      }
      if (url === "https://example.com/feed.xml") {
        return new Response("<rss><channel><title>Demo</title></channel></rss>", {
          status: 200,
          headers: { "content-type": "application/rss+xml" }
        });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const result = await discoverFeedUrl("https://example.com");
    assert.equal(result.feedUrl, "https://example.com/feed.xml");
    assert.equal(result.siteUrl, "https://example.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

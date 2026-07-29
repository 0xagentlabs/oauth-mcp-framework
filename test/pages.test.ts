import assert from "node:assert/strict";
import test from "node:test";

process.env.OAUTH_SECRET = "test-secret-that-is-longer-than-32-characters";

const pages = await import("../src/lib/pages.ts");

test("public pages escape executable HTML", () => {
  const html = pages.renderPage({
    title: "<script>alert(1)</script>",
    content: "<img src=x onerror=alert(1)>",
    createdAt: "2026-07-28T00:00:00.000Z",
  });
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
});

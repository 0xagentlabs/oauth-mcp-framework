import assert from "node:assert/strict";
import test from "node:test";

process.env.OAUTH_SECRET = "test-secret-that-is-longer-than-32-characters";

const pages = await import("../src/lib/pages.ts");

test("public pages render Markdown without executing raw HTML", () => {
  const html = pages.renderPage({
    title: "<script>alert(1)</script>",
    content: "## Section\n\n- one\n- two\n\n```js\nalert(1)\n```\n\nhttps://example.com\n\n<script>alert(1)</script>",
    createdAt: "2026-07-28T00:00:00.000Z",
  });
  assert.match(html, /<h2>Section<\/h2>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<pre><code class="language-js">/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

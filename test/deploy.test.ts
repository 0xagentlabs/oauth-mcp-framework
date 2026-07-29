import assert from "node:assert/strict";
import test from "node:test";
import { buildDeployUrl } from "../src/lib/deploy.ts";

test("deploy link requests only the selected environment variables", () => {
  const publicUrl = new URL(buildDeployUrl("https://github.com/acme/mcp", "my-mcp", false));
  const privateUrl = new URL(buildDeployUrl("https://github.com/acme/mcp", "my-mcp", true));
  assert.equal(publicUrl.searchParams.get("env"), "OAUTH_SECRET");
  assert.equal(privateUrl.searchParams.get("env"), "OAUTH_SECRET,MCP_AUTH_PASSWORD");
  assert.equal(privateUrl.searchParams.get("repository-url"), "https://github.com/acme/mcp");
});

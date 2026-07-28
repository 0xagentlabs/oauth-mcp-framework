import assert from "node:assert/strict";
import test from "node:test";

process.env.OAUTH_SECRET = "test-secret-that-is-longer-than-32-characters";
process.env.OAUTH_AUTHORIZATION_PASSWORD = "correct-horse-battery-staple";
process.env.KV_REST_API_URL = "https://kv.example";
process.env.KV_REST_API_TOKEN = "test-token";

const oauth = await import("../src/lib/oauth.ts");

test("rejects unknown scopes and redirect URIs", async () => {
  assert.throws(() => oauth.validateScope("mcp:tools admin"), /invalid_scope/);
  await assert.rejects(
    oauth.validateClient("grok", "https://attacker.example/callback"),
    /invalid_client/,
  );
  assert.equal(
    (await oauth.validateClient("grok", "https://grok.com/connectors-oauth-exchange-code/")).client_id,
    "grok",
  );
});

test("requires a valid S256 verifier", async () => {
  const verifier = "a".repeat(43);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  assert.equal(await oauth.verifyPkce(verifier, Buffer.from(digest).toString("base64url")), true);
  assert.equal(await oauth.verifyPkce("short", "irrelevant"), false);
});

test("authorization password is required", async () => {
  assert.equal(await oauth.verifyAuthorizationPassword("wrong-password"), false);
  assert.equal(await oauth.verifyAuthorizationPassword("correct-horse-battery-staple"), true);
});

test("authorization attempts are rate limited", async () => {
  let count = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const [command] = JSON.parse(String(init?.body)) as string[];
    if (command === "INCR") count += 1;
    return Response.json({ result: command === "INCR" ? count : 1 });
  };
  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.equal(await oauth.allowAuthorizationAttempt("192.0.2.1"), true);
    }
    assert.equal(await oauth.allowAuthorizationAttempt("192.0.2.1"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("unsigned demo tokens are rejected while issued access tokens remain valid", async () => {
  await assert.rejects(oauth.verifyAccessToken("demo-anything"));
  const issued = await oauth.createAccessToken({ client_id: "grok", scope: "mcp:tools" });
  assert.equal((await oauth.verifyAccessToken(issued.access_token)).client_id, "grok");
});

test("authorization code is consumed exactly once", async () => {
  const values = new Map<string, string>();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const [command, key, value] = JSON.parse(String(init?.body)) as string[];
    let result: unknown = null;
    if (command === "SET" && !values.has(key)) {
      values.set(key, value);
      result = "OK";
    } else if (command === "GETDEL") {
      result = values.get(key) ?? null;
      values.delete(key);
    }
    return Response.json({ result });
  };
  try {
    const code = await oauth.createAuthCode({
      client_id: "grok",
      redirect_uri: "https://grok.com/connectors-oauth-exchange-code/",
      code_challenge: "challenge",
      scope: "mcp:tools",
    });
    const payload = await oauth.verifyAuthCode(code);
    await oauth.consumeAuthCode(payload.jti!);
    await assert.rejects(oauth.consumeAuthCode(payload.jti!), /authorization_code_used/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

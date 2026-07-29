import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

process.env.OAUTH_SECRET = "test-secret-that-is-longer-than-32-characters";
process.env.KV_REST_API_URL = "https://kv.example";
process.env.KV_REST_API_TOKEN = "test-token";

const oauth = await import("../src/lib/oauth.ts");

test("production startup rejects missing Redis configuration", () => {
  const moduleUrl = new URL("../src/lib/oauth.ts", import.meta.url).href;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    OAUTH_SECRET: "x".repeat(32),
  };
  delete env.KV_REST_API_URL;
  delete env.KV_REST_API_TOKEN;
  delete env.UPSTASH_REDIS_REST_URL;
  delete env.UPSTASH_REDIS_REST_TOKEN;
  const result = spawnSync(process.execPath, [
    "--experimental-strip-types",
    "--input-type=module",
    "--eval",
    `await import(${JSON.stringify(moduleUrl)})`,
  ], { env, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Redis storage is required in production/);
});

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

test("dynamic registration only accepts the Grok callback", () => {
  assert.throws(
    () => oauth.registerGrokClient({ redirect_uris: ["https://attacker.example/callback"] }),
    /invalid_redirect_uri/,
  );
  const client = oauth.registerGrokClient({
    redirect_uris: ["https://grok.com/connectors-oauth-exchange-code/"],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  });
  assert.equal(client.client_id, "grok");
  assert.equal(client.token_endpoint_auth_method, "none");
});

test("requires a valid S256 verifier", async () => {
  const verifier = "a".repeat(43);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  assert.equal(await oauth.verifyPkce(verifier, Buffer.from(digest).toString("base64url")), true);
  assert.equal(await oauth.verifyPkce("short", "irrelevant"), false);
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

test("refresh tokens rotate and cannot be replayed", async () => {
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
    const pair = await oauth.createTokenPair({ client_id: "grok", scope: "mcp:tools offline_access" });
    const refresh = await oauth.verifyRefreshToken(pair.refresh_token);
    await oauth.consumeRefreshToken(refresh.jti!);
    await assert.rejects(oauth.consumeRefreshToken(refresh.jti!), /invalid_grant/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { BlobNotFoundError, BlobPreconditionFailedError } from "@vercel/blob";
import { claimBlobWith } from "../src/lib/blob-store.ts";

process.env.OAUTH_SECRET = "test-secret-that-is-longer-than-32-characters";

const oauth = await import("../src/lib/oauth.ts");

test("production reports missing configuration and rejects token operations", () => {
  const moduleUrl = new URL("../src/lib/oauth.ts", import.meta.url).href;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    OAUTH_SECRET: "x".repeat(32),
  };
  delete env.BLOB_READ_WRITE_TOKEN;
  delete env.VERCEL_OIDC_TOKEN;
  delete env.BLOB_STORE_ID;
  const result = spawnSync(process.execPath, [
    "--experimental-strip-types",
    "--input-type=module",
    "--eval",
    `const oauth = await import(${JSON.stringify(moduleUrl)});
     if (oauth.getConfigurationStatus().find((item) => item.name === "Blob 持久化")?.ok !== false) process.exit(2);
     try { await oauth.createAccessToken({ client_id: "grok", scope: "mcp:tools" }); process.exit(3); }
     catch (error) { if (!String(error).includes("Server configuration error")) process.exit(4); }`,
  ], { env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("production accepts a Blob Store ID for Vercel OIDC authentication", () => {
  const moduleUrl = new URL("../src/lib/oauth.ts", import.meta.url).href;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    OAUTH_SECRET: "x".repeat(32),
    BLOB_STORE_ID: "store_test",
  };
  delete env.BLOB_READ_WRITE_TOKEN;
  delete env.VERCEL_OIDC_TOKEN;
  const result = spawnSync(process.execPath, [
    "--experimental-strip-types",
    "--input-type=module",
    "--eval",
    `const oauth = await import(${JSON.stringify(moduleUrl)});
     if (oauth.getConfigurationStatus().find((item) => item.name === "Blob 持久化")?.ok !== true) process.exit(2);`,
  ], { env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
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

test("private mode rejects an incorrect access password", async () => {
  process.env.MCP_AUTH_PASSWORD = "private-access-password";
  await assert.rejects(oauth.validatePrivateAccess("wrong-password"), /access_denied/);
  await assert.doesNotReject(oauth.validatePrivateAccess("private-access-password"));
  delete process.env.MCP_AUTH_PASSWORD;
});

test("unsigned demo tokens are rejected while issued access tokens remain valid", async () => {
  await assert.rejects(oauth.verifyAccessToken("demo-anything"));
  const issued = await oauth.createAccessToken({ client_id: "grok", scope: "mcp:tools" });
  assert.equal((await oauth.verifyAccessToken(issued.access_token)).client_id, "grok");
});

test("Blob claim accepts a one-time token exactly once", async () => {
  const values = new Map<string, string>();
  values.set("issued", "1");
  const store = {
    head: async (path: string) => {
      if (!values.has(path)) throw new BlobNotFoundError();
      return {} as Awaited<ReturnType<typeof import("@vercel/blob").head>>;
    },
    put: async (path: string) => {
      if (values.has(path)) throw new BlobPreconditionFailedError();
      values.set(path, "1");
      return {} as Awaited<ReturnType<typeof import("@vercel/blob").put>>;
    },
    del: async (path: string | string[]) => {
      for (const item of Array.isArray(path) ? path : [path]) values.delete(item);
    },
  };
  assert.equal(await claimBlobWith("issued", "used", store), true);
  assert.equal(await claimBlobWith("issued", "used", store), false);
});

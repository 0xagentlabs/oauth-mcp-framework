import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { claimBlob, createBlob } from "./blob-store.ts";

const isProduction = process.env.NODE_ENV === "production";
const secretValue = process.env.OAUTH_SECRET;

if (isProduction && (!secretValue || secretValue.length < 32)) {
  throw new Error("OAUTH_SECRET must be at least 32 characters in production");
}
if (isProduction && !process.env.BLOB_READ_WRITE_TOKEN &&
    !(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)) {
  throw new Error("Vercel Blob storage is required in production");
}

const SECRET = new TextEncoder().encode(secretValue || "local-development-secret-change-me");

function getIssuer() {
  if (process.env.MCP_RESOURCE_URL) return process.env.MCP_RESOURCE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const ISSUER = getIssuer();
export const RESOURCE = `${ISSUER}/api/mcp`;
export const SCOPES = ["mcp:tools", "mcp:read", "mcp:write", "openid", "offline_access"];

type OAuthClient = { client_id: string; redirect_uris: string[]; client_name?: string };

export const GROK_REDIRECT_URI = "https://grok.com/connectors-oauth-exchange-code/";

const GROK_CLIENT: OAuthClient = {
  client_id: "grok",
  client_name: "Grok",
  redirect_uris: [GROK_REDIRECT_URI],
};

export function registerGrokClient(metadata: {
  redirect_uris?: unknown;
  token_endpoint_auth_method?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
  client_name?: unknown;
}) {
  if (!Array.isArray(metadata.redirect_uris) ||
      metadata.redirect_uris.length !== 1 ||
      metadata.redirect_uris[0] !== GROK_REDIRECT_URI) {
    throw new Error("invalid_redirect_uri");
  }
  if (metadata.token_endpoint_auth_method != null && metadata.token_endpoint_auth_method !== "none") {
    throw new Error("invalid_client_metadata");
  }
  if (metadata.grant_types != null &&
      (!Array.isArray(metadata.grant_types) || metadata.grant_types.some((value) => value !== "authorization_code" && value !== "refresh_token"))) {
    throw new Error("invalid_client_metadata");
  }
  if (metadata.response_types != null &&
      (!Array.isArray(metadata.response_types) || metadata.response_types.some((value) => value !== "code"))) {
    throw new Error("invalid_client_metadata");
  }
  return {
    client_id: GROK_CLIENT.client_id,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: typeof metadata.client_name === "string" ? metadata.client_name.slice(0, 100) : "Grok",
    redirect_uris: GROK_CLIENT.redirect_uris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  };
}

export async function validateClient(clientId: string, redirectUri: string): Promise<OAuthClient> {
  if (clientId !== GROK_CLIENT.client_id || !GROK_CLIENT.redirect_uris.includes(redirectUri)) {
    throw new Error("invalid_client");
  }
  return GROK_CLIENT;
}

export function validateClientId(clientId: string): void {
  if (clientId !== GROK_CLIENT.client_id) throw new Error("invalid_client");
}

export function validateScope(scope: string): string {
  const requested = [...new Set(scope.split(/\s+/).filter(Boolean))];
  if (!requested.length || requested.some((item) => !SCOPES.includes(item))) {
    throw new Error("invalid_scope");
  }
  return requested.join(" ");
}

export async function createAuthCode(payload: {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string;
}): Promise<string> {
  const jti = crypto.randomUUID();
  const code = await new SignJWT({ typ: "auth_code", ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(SECRET);
  await createBlob(`oauth/issued/code/${jti}`, "1");
  return code;
}

export async function verifyAuthCode(code: string): Promise<JWTPayload & {
  client_id: string; redirect_uri: string; code_challenge: string; scope: string;
}> {
  const { payload } = await jwtVerify(code, SECRET, { issuer: ISSUER });
  if (payload.typ !== "auth_code" || !payload.jti) throw new Error("invalid_code");
  return payload as JWTPayload & {
    client_id: string; redirect_uri: string; code_challenge: string; scope: string;
  };
}

export async function consumeAuthCode(jti: string): Promise<void> {
  if (!await claimBlob(`oauth/issued/code/${jti}`, `oauth/used/code/${jti}`)) {
    throw new Error("authorization_code_used");
  }
}

export async function createAccessToken(opts: { client_id: string; scope: string; sub?: string }) {
  const expiresIn = 3600;
  const access_token = await new SignJWT({
    typ: "access_token",
    client_id: opts.client_id,
    scope: opts.scope,
    sub: opts.sub || "resource-owner",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(RESOURCE)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(SECRET);
  return { access_token, expires_in: expiresIn, token_type: "Bearer", scope: opts.scope };
}

export async function createTokenPair(opts: { client_id: string; scope: string; sub?: string }) {
  const access = await createAccessToken(opts);
  const jti = crypto.randomUUID();
  const refresh_token = await new SignJWT({
    typ: "refresh_token",
    client_id: opts.client_id,
    scope: opts.scope,
    sub: opts.sub || "resource-owner",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(RESOURCE)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
  await createBlob(`oauth/issued/refresh/${jti}`, "1");
  return { ...access, refresh_token };
}

export async function verifyRefreshToken(token: string): Promise<JWTPayload & {
  client_id: string; scope: string; sub: string;
}> {
  const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER, audience: RESOURCE });
  if (payload.typ !== "refresh_token" || !payload.jti) throw new Error("invalid_grant");
  return payload as JWTPayload & { client_id: string; scope: string; sub: string };
}

export async function consumeRefreshToken(jti: string): Promise<void> {
  if (!await claimBlob(`oauth/issued/refresh/${jti}`, `oauth/used/refresh/${jti}`)) {
    throw new Error("invalid_grant");
  }
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER, audience: RESOURCE });
  if (payload.typ !== "access_token") throw new Error("invalid_token");
  return payload;
}

export async function verifyPkce(codeVerifier: string, codeChallenge: string) {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(codeVerifier)) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  const computed = Buffer.from(digest).toString("base64url");
  return computed === codeChallenge;
}

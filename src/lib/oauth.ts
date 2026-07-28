import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.OAUTH_SECRET || "mcp-oauth-demo-secret-change-me-in-prod-2026"
);

function getIssuer() {
  if (process.env.MCP_RESOURCE_URL) return process.env.MCP_RESOURCE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://oauth-mcp-framework.vercel.app";
}

export const ISSUER = getIssuer();
export const RESOURCE = `${ISSUER}/api/mcp`;
export const SCOPES = ["mcp:tools", "mcp:read", "mcp:write", "openid"];

export async function createAuthCode(payload: {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
  state?: string;
}): Promise<string> {
  return new SignJWT({ typ: "auth_code", ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(SECRET);
}

export async function verifyAuthCode(code: string) {
  const { payload } = await jwtVerify(code, SECRET, { issuer: ISSUER });
  if (payload.typ !== "auth_code") throw new Error("invalid_code");
  return payload as any;
}

export async function createAccessToken(opts: {
  client_id: string;
  scope: string;
  sub?: string;
}) {
  const expiresIn = 3600 * 24 * 7;
  const access_token = await new SignJWT({
    typ: "access_token",
    client_id: opts.client_id,
    scope: opts.scope,
    sub: opts.sub || "demo-user",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(RESOURCE)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(SECRET);
  return { access_token, expires_in: expiresIn, token_type: "Bearer", scope: opts.scope };
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER, audience: RESOURCE });
  if (payload.typ !== "access_token") throw new Error("invalid_token");
  return payload as any;
}

export async function verifyPkce(codeVerifier: string, codeChallenge: string) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const computed = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return computed === codeChallenge;
}

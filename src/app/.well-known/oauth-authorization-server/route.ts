import { NextResponse } from "next/server";
import { ISSUER, SCOPES } from "@/lib/oauth";

export async function GET() {
  const metadata: Record<string, unknown> = {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/oauth/authorize`,
    token_endpoint: `${ISSUER}/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: SCOPES,
    subject_types_supported: ["public"],
  };
  if (process.env.OAUTH_ALLOW_DYNAMIC_REGISTRATION === "true") {
    metadata.registration_endpoint = `${ISSUER}/oauth/register`;
  }
  return NextResponse.json(metadata, { headers: { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" } });
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "*" } });
}

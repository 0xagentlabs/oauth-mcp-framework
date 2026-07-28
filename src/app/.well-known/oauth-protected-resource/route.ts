import { NextResponse } from "next/server";
import { ISSUER, RESOURCE, SCOPES } from "@/lib/oauth";

export async function GET() {
  return NextResponse.json({
    resource: RESOURCE,
    authorization_servers: [ISSUER],
    scopes_supported: SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "OAuth MCP Framework",
  }, { headers: { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" } });
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "*" } });
}

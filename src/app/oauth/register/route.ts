import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const client_id = "grok-" + Math.random().toString(36).slice(2, 10);
  return NextResponse.json({
    client_id,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: body.redirect_uris || [],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code"],
    response_types: ["code"],
    client_name: body.client_name || "MCP Client",
  }, { status: 201, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "*" } });
}

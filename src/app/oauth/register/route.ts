import { NextRequest, NextResponse } from "next/server";
import { registerClient } from "@/lib/oauth";

export async function POST(req: NextRequest) {
  if (process.env.OAUTH_ALLOW_DYNAMIC_REGISTRATION !== "true") {
    return NextResponse.json({ error: "registration_not_supported" }, { status: 404 });
  }
  try {
    const body = await req.json() as { redirect_uris?: unknown; client_name?: unknown };
    if (!Array.isArray(body.redirect_uris) || !body.redirect_uris.length ||
        !body.redirect_uris.every((uri) => typeof uri === "string" && /^https:\/\/[^#]+$/.test(uri))) {
      return NextResponse.json({ error: "invalid_redirect_uri" }, { status: 400 });
    }
    const client_id = `mcp-${crypto.randomUUID()}`;
    await registerClient({
      client_id,
      redirect_uris: body.redirect_uris,
      client_name: typeof body.client_name === "string" ? body.client_name.slice(0, 100) : "MCP Client",
    });
    return NextResponse.json({
      client_id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: body.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      client_name: body.client_name || "MCP Client",
    }, { status: 201, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
  } catch {
    return NextResponse.json({ error: "invalid_client_metadata" }, { status: 400 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthCode, verifyPkce, createAccessToken } from "@/lib/oauth";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, string> = {};
    if (contentType.includes("application/json")) body = await req.json();
    else {
      const text = await req.text();
      body = Object.fromEntries(new URLSearchParams(text));
    }
    const { grant_type, code, redirect_uri, client_id = "grok", code_verifier } = body;
    if (grant_type !== "authorization_code") return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
    if (!code || !redirect_uri || !code_verifier) return NextResponse.json({ error: "invalid_request", error_description: "code, redirect_uri, code_verifier required" }, { status: 400 });
    const authCode = await verifyAuthCode(code);
    if (authCode.redirect_uri !== redirect_uri) return NextResponse.json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, { status: 400 });
    if (authCode.client_id !== client_id) return NextResponse.json({ error: "invalid_grant", error_description: "client_id mismatch" }, { status: 400 });
    if (!(await verifyPkce(code_verifier, authCode.code_challenge))) return NextResponse.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, { status: 400 });
    const token = await createAccessToken({ client_id, scope: authCode.scope, sub: "demo-user" });
    return NextResponse.json(token, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
  } catch (err: any) {
    console.error("[token]", err);
    return NextResponse.json({ error: "invalid_grant", error_description: err?.message || "invalid code" }, { status: 400 });
  }
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "*" } });
}

import { NextRequest, NextResponse } from "next/server";
import {
  consumeAuthCode,
  createAccessToken,
  validateClient,
  verifyAuthCode,
  verifyPkce,
} from "@/lib/oauth";

const corsHeaders = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
};

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const body: Record<string, string> = contentType.includes("application/json")
      ? await req.json()
      : Object.fromEntries(new URLSearchParams(await req.text()));
    const { grant_type, code, redirect_uri, client_id, code_verifier } = body;
    if (grant_type !== "authorization_code") {
      return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400, headers: corsHeaders });
    }
    if (!code || !redirect_uri || !client_id || !code_verifier) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: corsHeaders });
    }
    await validateClient(client_id, redirect_uri);
    const authCode = await verifyAuthCode(code);
    if (authCode.redirect_uri !== redirect_uri || authCode.client_id !== client_id) {
      throw new Error("invalid_grant");
    }
    if (!await verifyPkce(code_verifier, authCode.code_challenge)) throw new Error("invalid_grant");
    await consumeAuthCode(authCode.jti!);
    return NextResponse.json(
      await createAccessToken({ client_id, scope: authCode.scope }),
      { headers: corsHeaders },
    );
  } catch {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

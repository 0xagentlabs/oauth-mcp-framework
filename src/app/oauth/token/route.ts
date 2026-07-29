import { NextRequest, NextResponse } from "next/server";
import { BlobStorageError } from "@/lib/blob-store";
import {
  consumeAuthCode,
  consumeRefreshToken,
  createTokenPair,
  validateClient,
  validateClientId,
  verifyAuthCode,
  verifyPkce,
  verifyRefreshToken,
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
    const { grant_type, client_id } = body;
    if (!client_id) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: corsHeaders });
    }
    if (grant_type === "refresh_token") {
      validateClientId(client_id);
      if (!body.refresh_token) throw new Error("invalid_grant");
      const refresh = await verifyRefreshToken(body.refresh_token);
      if (refresh.client_id !== client_id) throw new Error("invalid_grant");
      await consumeRefreshToken(refresh.jti!);
      return NextResponse.json(
        await createTokenPair({ client_id, scope: refresh.scope, sub: refresh.sub }),
        { headers: corsHeaders },
      );
    }
    if (grant_type !== "authorization_code") {
      return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400, headers: corsHeaders });
    }
    const { code, redirect_uri, code_verifier } = body;
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
      await createTokenPair({ client_id, scope: authCode.scope }),
      { headers: corsHeaders },
    );
  } catch (error) {
    if (error instanceof BlobStorageError) {
      console.error(error.message, error.cause);
      return NextResponse.json(
        { error: "temporarily_unavailable", error_description: "OAuth storage is unavailable. Check the Vercel Blob binding." },
        { status: 503, headers: corsHeaders },
      );
    }
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

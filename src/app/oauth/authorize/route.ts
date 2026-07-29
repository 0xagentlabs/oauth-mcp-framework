import { NextRequest, NextResponse } from "next/server";
import { BlobStorageError } from "@/lib/blob-store";
import {
  createAuthCode,
  ISSUER,
  validateClient,
  validateScope,
} from "@/lib/oauth";

type AuthorizationRequest = {
  client_id: string;
  redirect_uri: string;
  state: string;
  scope: string;
  code_challenge: string;
};

const esc = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

async function parseAuthorizationRequest(values: URLSearchParams): Promise<AuthorizationRequest> {
  const request = {
    client_id: values.get("client_id") || "",
    redirect_uri: values.get("redirect_uri") || "",
    state: values.get("state") || "",
    scope: validateScope(values.get("scope") || "mcp:tools"),
    code_challenge: values.get("code_challenge") || "",
  };
  if (values.get("response_type") !== "code") throw new Error("unsupported_response_type");
  if (values.get("code_challenge_method") !== "S256" || !request.code_challenge) {
    throw new Error("invalid_request");
  }
  await validateClient(request.client_id, request.redirect_uri);
  return request;
}

function errorResponse(error: unknown) {
  if (error instanceof BlobStorageError) {
    console.error(error.message, error.cause);
    return NextResponse.json(
      { error: "server_error", error_description: "OAuth storage is unavailable. Check the Vercel Blob binding." },
      { status: 503 },
    );
  }
  const message = error instanceof Error ? error.message : "invalid_request";
  const publicErrors = ["unsupported_response_type", "invalid_request", "invalid_client", "invalid_scope"];
  if (!publicErrors.includes(message)) console.error("OAuth authorization failed", error);
  return NextResponse.json(
    { error: publicErrors.includes(message) ? message : "server_error" },
    { status: publicErrors.includes(message) ? 400 : 500 },
  );
}

export async function GET(req: NextRequest) {
  try {
    const request = await parseAuthorizationRequest(req.nextUrl.searchParams);
    const hidden = [
      ["client_id", request.client_id],
      ["redirect_uri", request.redirect_uri],
      ["response_type", "code"],
      ["scope", request.scope],
      ["state", request.state],
      ["code_challenge", request.code_challenge],
      ["code_challenge_method", "S256"],
    ].map(([name, value]) => `<input type="hidden" name="${name}" value="${esc(value)}">`).join("");
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>授权 MCP 连接</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0b0f19;color:#e5e7eb}.card{background:#111827;border:1px solid #1f2937;border-radius:16px;padding:2rem;max-width:420px;width:90%}h1{font-size:1.4rem;margin:0 0 .5rem}p{color:#9ca3af}.meta{background:#0b0f19;border-radius:8px;padding:.75rem 1rem;margin:1.25rem 0;font-size:.8rem;color:#9ca3af;word-break:break-all}.btn{width:100%;border:0;background:#3b82f6;color:#fff;border-radius:10px;padding:.85rem;font-weight:600;cursor:pointer}</style></head>
<body><form class="card" method="post" action="${esc(`${ISSUER}/oauth/authorize`)}"><h1>授权 MCP 工具</h1><p>确认允许 Grok 使用以下公开工具权限。</p>
<div class="meta"><div><strong>Client</strong>: ${esc(request.client_id)}</div><div><strong>Scopes</strong>: ${esc(request.scope)}</div></div>
${hidden}<button class="btn" type="submit">确认授权</button></form></body></html>`;
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; form-action ${new URL(ISSUER).origin}; frame-ancestors 'none'`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const values = new URLSearchParams();
    for (const [key, value] of form) if (typeof value === "string") values.set(key, value);
    const request = await parseAuthorizationRequest(values);
    const code = await createAuthCode(request);
    const url = new URL(request.redirect_uri);
    url.searchParams.set("code", code);
    if (request.state) url.searchParams.set("state", request.state);
    return NextResponse.redirect(url, 303);
  } catch (error) {
    return errorResponse(error);
  }
}

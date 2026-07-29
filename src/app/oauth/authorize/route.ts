import { NextRequest, NextResponse } from "next/server";
import { BlobStorageError } from "@/lib/blob-store";
import {
  createAuthCode,
  GROK_REDIRECT_URI,
  ISSUER,
  PRIVATE_ACCESS,
  validateClient,
  validatePrivateAccess,
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
  const publicErrors = ["unsupported_response_type", "invalid_request", "invalid_client", "invalid_scope", "access_denied"];
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
<style>*{box-sizing:border-box}body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px;background:radial-gradient(circle at 50% 0,#172554 0,#090d16 48%);color:#f8fafc}.card{width:min(100%,440px);padding:32px;border:1px solid #263349;border-radius:24px;background:rgba(17,24,39,.9);box-shadow:0 28px 80px #0008}.icon{display:grid;place-items:center;width:48px;height:48px;margin-bottom:22px;border-radius:14px;background:#2563eb;font-size:24px}.eyebrow{margin:0 0 8px;color:#60a5fa;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}h1{font-size:26px;letter-spacing:-.03em;margin:0 0 10px}p{margin:0;color:#9ca3af;line-height:1.6}.meta{display:grid;gap:12px;margin:24px 0;padding:16px;border:1px solid #263349;border-radius:14px;background:#0b111d;font-size:13px;color:#aeb8c7}.row{display:flex;justify-content:space-between;gap:16px}.row span:first-child{color:#6b7a90}.row span:last-child{word-break:break-all;text-align:right}.field{display:grid;gap:8px;margin:0 0 18px}.field label{font-size:13px;font-weight:650}.field input{width:100%;padding:13px 14px;border:1px solid #35435a;border-radius:11px;outline:0;background:#0b111d;color:#fff;font:inherit}.field input:focus{border-color:#60a5fa;box-shadow:0 0 0 3px #2563eb33}.btn{width:100%;border:0;background:#2563eb;color:#fff;border-radius:12px;padding:14px;font-weight:700;font-size:15px;cursor:pointer}.btn:hover{background:#1d4ed8}.secure{margin-top:14px;text-align:center;font-size:12px;color:#66758a}</style></head>
<body><form class="card" method="post" action="${esc(`${ISSUER}/oauth/authorize`)}"><div class="icon">↗</div><p class="eyebrow">OAuth authorization</p><h1>授权 MCP 工具</h1><p>允许 Grok 连接此服务并使用申请的工具权限。</p>
<div class="meta"><div class="row"><span>客户端</span><span>${esc(request.client_id)}</span></div><div class="row"><span>权限</span><span>${esc(request.scope)}</span></div></div>
${hidden}${PRIVATE_ACCESS ? '<div class="field"><label for="password">私有访问密码</label><input id="password" name="password" type="password" required minlength="16" autocomplete="current-password" placeholder="输入部署者提供的密码"></div>' : ""}
<button class="btn" type="submit">确认并授权</button><div class="secure">S256 PKCE · Token 不会显示在此页面</div></form></body></html>`;
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; form-action ${new URL(ISSUER).origin} ${new URL(GROK_REDIRECT_URI).origin}; frame-ancestors 'none'`,
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
    await validatePrivateAccess(String(form.get("password") || ""));
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

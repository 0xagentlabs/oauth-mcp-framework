import { NextRequest, NextResponse } from "next/server";
import { createAuthCode, SCOPES } from "@/lib/oauth";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const client_id = sp.get("client_id") || "grok";
  const redirect_uri = sp.get("redirect_uri") || "";
  const response_type = sp.get("response_type") || "code";
  const scope = sp.get("scope") || SCOPES.join(" ");
  const state = sp.get("state") || "";
  const code_challenge = sp.get("code_challenge") || "";
  const code_challenge_method = sp.get("code_challenge_method") || "S256";

  if (response_type !== "code") return NextResponse.json({ error: "unsupported_response_type" }, { status: 400 });
  if (!redirect_uri) return NextResponse.json({ error: "invalid_request", error_description: "redirect_uri required" }, { status: 400 });
  if (!code_challenge) return NextResponse.json({ error: "invalid_request", error_description: "PKCE code_challenge required" }, { status: 400 });

  if (sp.get("approve") === "1") {
    const code = await createAuthCode({ client_id, redirect_uri, code_challenge, code_challenge_method, scope, state });
    const url = new URL(redirect_uri);
    url.searchParams.set("code", code);
    if (state) url.searchParams.set("state", state);
    return NextResponse.redirect(url.toString());
  }

  const approveUrl = new URL(req.nextUrl);
  approveUrl.searchParams.set("approve", "1");

  const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>授权 MCP 连接</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0b0f19;color:#e5e7eb}.card{background:#111827;border:1px solid #1f2937;border-radius:16px;padding:2rem;max-width:420px;width:90%;text-align:center}h1{font-size:1.4rem;margin:0 0 .5rem}p{color:#9ca3af}.meta{background:#0b0f19;border-radius:8px;padding:.75rem 1rem;margin:1.25rem 0;font-size:.8rem;text-align:left;color:#9ca3af;word-break:break-all}.btn{display:inline-block;background:#3b82f6;color:#fff;border-radius:10px;padding:.85rem 1.75rem;font-weight:600;text-decoration:none}.btn:hover{background:#2563eb}.cancel{display:block;margin-top:1rem;color:#6b7280;font-size:.85rem;text-decoration:none}</style></head>
<body><div class="card"><h1>授权 MCP 工具</h1><p>Grok（或其他 MCP 客户端）请求访问你的自定义工具服务器。</p>
<div class="meta"><div><strong>Client</strong>: ${esc(client_id)}</div><div><strong>Scopes</strong>: ${esc(scope)}</div></div>
<a class="btn" href="${approveUrl.toString()}">授权连接</a>
<a class="cancel" href="${esc(redirect_uri)}">取消</a></div></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

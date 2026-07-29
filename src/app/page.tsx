export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", lineHeight: 1.6, fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>OAuth MCP Framework</h1>
      <p>支持 OAuth 授权码流程、S256 PKCE 和一次性授权码的 MCP 服务器。</p>
      <h2>连接配置</h2>
      <p>客户端应通过 OAuth 元数据自动发现授权端点，并使用服务器的 <code>/api/mcp</code> 作为 MCP URL。</p>
      <ul>
        <li>Authorization metadata: <code>/.well-known/oauth-authorization-server</code></li>
        <li>Protected resource metadata: <code>/.well-known/oauth-protected-resource</code></li>
        <li>MCP endpoint: <code>/api/mcp</code></li>
        <li>Scope: <code>mcp:tools</code></li>
      </ul>
      <p>客户端 ID 和 Grok 回调地址均已内置。连接时只需在浏览器确认公开授权。</p>
    </main>
  );
}

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", lineHeight: 1.6, fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>OAuth MCP Framework</h1>
      <p>支持 OAuth 2.1 + PKCE 的 MCP 服务器，可在 Grok 自定义连接器中接近「一键连接」。</p>
      <h2>Grok 自定义连接器填写值</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <tbody>
          {[
            ["Server URL", "https://oauth-mcp-framework.vercel.app/api/mcp"],
            ["客户端ID", "grok"],
            ["客户端密钥", "（留空）"],
            ["授权端点", "https://oauth-mcp-framework.vercel.app/oauth/authorize"],
            ["令牌端点", "https://oauth-mcp-framework.vercel.app/oauth/token"],
            ["范围", "mcp:tools"],
            ["令牌认证方法", "无 (仅 PKCE, 推荐)"],
          ].map(([k, v]) => (
            <tr key={k} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "8px 4px", fontWeight: 600, width: 140 }}>{k}</td>
              <td style={{ padding: "8px 4px" }}><code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>{v}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ marginTop: "2rem" }}>操作步骤</h2>
      <ol>
        <li>打开 <a href="https://grok.com/connectors" target="_blank">grok.com/connectors</a></li>
        <li>New Connector → Custom</li>
        <li>Server URL 填上面的地址</li>
        <li>在弹出的 OAuth 表单里按上表填写</li>
        <li>点「保存并连接」→ 浏览器打开授权页 → 点「授权连接」</li>
      </ol>
      <h2>Demo Bearer（调试）</h2>
      <pre style={{ background: "#111", color: "#0f0", padding: "1rem", borderRadius: 8 }}>Authorization: Bearer mcp-demo-secret-2026</pre>
    </main>
  );
}

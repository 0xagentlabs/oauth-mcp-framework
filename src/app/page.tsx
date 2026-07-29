import { getConfigurationStatus } from "@/lib/oauth";

export default function Home() {
  const configuration = getConfigurationStatus();
  const ready = configuration.every((item) => item.ok);
  return (
    <main className="home">
      <p className="eyebrow">OAuth 2.1 · Streamable HTTP</p>
      <h1>OAuth MCP Framework</h1>
      <p className="lead">支持授权码、S256 PKCE、Token 轮换和标准元数据发现的 MCP 服务。</p>
      <h2>连接配置</h2>
      <p>在 Grok Custom Connector 中只需填写 MCP 地址，客户端会自动发现其余 OAuth 配置。</p>
      <ul className="endpoint-list">
        <li><span>MCP URL</span><code>/api/mcp</code></li>
        <li><span>Authorization metadata</span><code>/.well-known/oauth-authorization-server</code></li>
        <li><span>Protected resource</span><code>/.well-known/oauth-protected-resource/api/mcp</code></li>
        <li><span>Required scope</span><code>mcp:tools</code></li>
      </ul>
      <p className="note">Client ID 和 Grok 回调地址已内置。私有模式下还需在授权页输入部署者设置的访问密码。</p>
      <h2>配置检测</h2>
      <div className={`status-summary ${ready ? "ready" : "warning"}`}>
        <span className="status-dot" />
        {ready ? "服务配置完整，可以接受 OAuth 连接" : "配置不完整，OAuth 请求将被拒绝"}
      </div>
      <ul className="status-list">
        {configuration.map((item) => (
          <li key={item.name}>
            <span><span className={`status-icon ${item.ok ? "ok" : "bad"}`}>{item.ok ? "✓" : "!"}</span>{item.name}</span>
            <strong>{item.detail}</strong>
          </li>
        ))}
      </ul>
      {!ready && <p className="note">请检查部署环境变量和 Blob 绑定，修改后重新部署。检测结果不会显示任何密钥内容。</p>}
    </main>
  );
}

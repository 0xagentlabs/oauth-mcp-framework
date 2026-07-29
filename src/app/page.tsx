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
      <h2>启用私有 MCP</h2>
      <section className="private-guide">
        <div className="guide-heading">
          <span className="guide-icon">⌁</span>
          <div>
            <strong>单所有者密码保护</strong>
            <p>授权前验证访问密码，适合个人或少量可信使用者。</p>
          </div>
        </div>
        <ol>
          <li>打开 Vercel Project 的 <strong>Settings → Environment Variables</strong>。</li>
          <li>
            添加环境变量：
            <div className="config-row">
              <code>MCP_AUTH_PASSWORD</code>
              <span>至少 16 个随机字符</span>
            </div>
          </li>
          <li>Environment 选择 <strong>Production</strong>，保存后到 Deployments 执行 <strong>Redeploy</strong>。</li>
          <li>删除 Grok 中的旧连接，重新连接并在授权页输入该密码。</li>
        </ol>
        <p className="guide-warning">轮换访问密码不会撤销已经签发的 Token。如需撤销全部连接，同时轮换 <code>OAUTH_SECRET</code>。</p>
      </section>
    </main>
  );
}

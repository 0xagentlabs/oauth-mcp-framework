# OAuth MCP Framework

一个面向 Grok Custom Connector 的 MCP 服务模板，内置 OAuth Authorization Code、S256 PKCE、Access Token、Refresh Token 和标准 OAuth 元数据发现。

## 最简单配置

生产环境只需：

| 项目 | 配置 |
|---|---|
| 环境变量 | `OAUTH_SECRET`：至少 32 字符的独立随机值 |
| 持久化存储 | 一个连接到项目的 Private Vercel Blob Store |
| Grok MCP URL | `https://你的域名/api/mcp` |

以下内容已经内置或由部署平台注入，无需配置：

- Client ID：`grok`
- Client Secret：留空
- Grok 回调地址：已内置
- `MCP_RESOURCE_URL`：使用默认生产域名时自动推导
- `BLOB_READ_WRITE_TOKEN`：连接 Blob Store 后自动注入

完整部署步骤见 [部署说明](docs/configuration.md)。

## OAuth 发现流程

```text
Grok 请求 /api/mcp（未携带 Token）
  → 服务返回 401 和 Protected Resource Metadata 地址
  → Grok 读取 /.well-known/oauth-protected-resource/api/mcp
  → Grok 读取 /.well-known/oauth-authorization-server
  → Grok 通过 /oauth/register 获取固定 Client ID：grok
  → Grok 得到授权地址、Token 地址、scope 和 PKCE 要求
```

## 用户授权流程

```text
Grok 生成 PKCE verifier、challenge 和 state
  → 浏览器打开 GET /oauth/authorize
  → 服务校验 Client ID、回调地址、scope 和 S256 PKCE
  → 用户点击“确认授权”
  → 服务生成 5 分钟、一次性的授权码
  → 浏览器跳回 Grok 固定回调地址
  → Grok 调用 POST /oauth/token，并提交授权码和 verifier
  → 服务校验并消费授权码
  → 返回 1 小时 Access Token 和 30 天 Refresh Token
```

Refresh Token 每次使用后立即失效，同时签发新的 Token 对；重复使用旧 Refresh Token 会被拒绝。

> 当前授权页只确认是否授权，不验证真实用户身份。任何 Grok 用户都能授权并调用全部工具。若工具涉及私有数据、多用户隔离或敏感操作，必须先接入外部身份提供商。

## MCP 执行流程

```text
Grok 携带 Authorization: Bearer <Access Token> 请求 /api/mcp
  → 服务验证 JWT 签名、issuer、audience 和 Token 类型
  → 服务检查 mcp:tools scope
  → MCP 协议处理器解析请求并匹配工具
  → Zod 校验工具参数
  → 执行工具并返回 MCP 结果
```

Access Token 无效、过期或缺少 `mcp:tools` 时，请求不会进入工具。

## 示例工具

- `hello`
- `publish_page`：将 Markdown 渲染为永久公开页面并返回 URL（禁用原始 HTML）

业务工具统一注册在 `src/app/api/[transport]/route.ts`。开发说明见 [二次开发文档](docs/development.md)。

## 端点

| 用途 | 地址 |
|---|---|
| MCP | `/api/mcp` |
| 授权页 | `/oauth/authorize` |
| Token | `/oauth/token` |
| 动态客户端注册 | `/oauth/register` |
| 授权服务器元数据 | `/.well-known/oauth-authorization-server` |
| 受保护资源元数据 | `/.well-known/oauth-protected-resource/api/mcp` |

## 安全边界

- 授权码有效期 5 分钟，只能兑换一次。
- Access Token 有效期 1 小时，并绑定 MCP audience。
- Refresh Token 有效期 30 天，单次使用并轮换。
- 授权码和 Refresh Token 的消费状态保存在 Private Blob Store。
- 轮换 `OAUTH_SECRET` 会使现有授权码和全部 Token 立即失效。

## License

MIT

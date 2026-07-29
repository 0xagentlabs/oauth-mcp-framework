# Grok 自动 OAuth MCP 接入指南

本文说明如何让 Grok 像连接 Notion 一样，通过 MCP Server URL 自动发现 OAuth 配置，并在一次浏览器授权后使用 MCP 工具。

## 1. 目标体验

用户只需：

1. 打开 [Grok Connectors](https://grok.com/connectors)。
2. 选择 **New Connector** → **Custom**。
3. 填写公网 HTTPS MCP Server URL。
4. 在浏览器中完成一次 OAuth 授权。
5. 返回 Grok 使用自动发现的 MCP 工具。

用户不需要复制 Access Token，也不需要在每次调用时填写 API Key。

## 2. 标准参考

以 Notion 官方 MCP 为参考：

- MCP URL：`https://mcp.notion.com/mcp`
- 传输：Streamable HTTP
- 授权：OAuth Authorization Code + PKCE
- 授权服务器发现：Authorization Server Metadata（RFC 8414）
- 受保护资源发现：OAuth Protected Resource Metadata（RFC 9728）

客户端通过标准元数据确定授权地址、Token 地址、支持的 scope 和 PKCE 方法，然后完成浏览器授权。

> Protected Resource Metadata 对应 RFC 9728，不是 RFC 9470。

## 3. 用户侧连接流程

### Grok Web UI

1. 打开 `https://grok.com/connectors`。
2. 点击 **New Connector**。
3. 选择 **Custom**。
4. 填写：

   | 字段 | 内容 |
   |---|---|
   | Name | 自定义连接器名称 |
   | Server URL | MCP 服务的公网 HTTPS URL，例如 `https://mcp.example.com/api/mcp` |

5. 保存连接器。
6. Grok 访问 MCP Server，并根据认证响应读取 OAuth 元数据。
7. 浏览器打开授权页。
8. 用户登录或输入授权凭据，并同意 scope。
9. Grok 使用授权码和 PKCE verifier 换取 Access Token。
10. Grok 携带 Bearer Token 调用 MCP Server。

如果 Grok 当前 UI 要求额外填写 Client ID、Authorization Endpoint 或 Token Endpoint，说明自动注册或自动发现未完全生效，应按当前 Grok UI 和官方文档补充配置。

### CLI

部分客户端提供 `mcp add` 类型的 CLI 命令，并把 OAuth Token 保存在本地凭据文件中。Grok CLI 的具体命令、参数和凭据路径可能随版本变化，使用前应以当前官方文档为准，不应把未经确认的命令写入自动化脚本。

## 4. 服务端最低要求

| 能力 | 要求 |
|---|---|
| 网络 | 公网可访问的 HTTPS |
| MCP 传输 | Streamable HTTP；SSE 仅用于需要兼容的旧客户端 |
| OAuth 流程 | Authorization Code |
| PKCE | 必须支持 S256 |
| Protected Resource Metadata | `/.well-known/oauth-protected-resource` |
| Authorization Server Metadata | `/.well-known/oauth-authorization-server` |
| Token 使用 | MCP 请求携带 `Authorization: Bearer ...` |
| Scope | 元数据声明并由 MCP 服务端强制校验 |

仅部署 MCP 工具端点不够。客户端必须能够从未认证响应或已知的 well-known 地址发现受保护资源和授权服务器。

## 5. 推荐增强能力

以下能力可以改善兼容性和长期使用体验，但不是最小自动发现流程的硬性前提。

### Dynamic Client Registration

支持 DCR 后，客户端可以自动获得 `client_id`，用户通常不需要手工填写 Client ID 或 Client Secret。

DCR 会引入额外风险：

- 批量注册消耗存储。
- 任意客户端注册。
- 回调地址管理。
- 注册接口滥用。

生产环境应增加客户端元数据校验、速率限制和存储清理。若目标客户端及回调地址固定，预置客户端通常更简单、更安全。

### Refresh Token

短期 Access Token 配合 Refresh Token 可以减少用户重复授权。服务端需要额外实现：

- `refresh_token` grant
- Refresh Token 轮换
- 重放检测
- 撤销机制
- 独立的有效期和存储策略

`offline_access` 通常用于请求离线访问，但是否支持以及具体语义由授权服务器决定，不能只在 scope 列表中添加名称而不实现 Refresh Token。

### 外部身份提供商

需要多用户、SSO、MFA、账户恢复或审计时，应使用成熟 IdP。统一管理员口令只适合单所有者部署。

## 6. 不支持 DCR 时

客户端可能要求手工填写：

| 字段 | 示例 |
|---|---|
| Client ID | `grok` |
| Client Secret | 留空 |
| Authorization Endpoint | `https://mcp.example.com/oauth/authorize` |
| Token Endpoint | `https://mcp.example.com/oauth/token` |
| Scopes | `mcp:tools mcp:read mcp:write openid` |
| Token Auth Method | `none` |
| PKCE Method | `S256` |

即使不支持 DCR，Authorization Server Metadata、Protected Resource Metadata 和 PKCE 仍应完整实现。

## 7. 推荐架构

```text
用户浏览器 ←→ Grok（MCP Client）
                  │
                  │ OAuth + PKCE / Bearer Token
                  ▼
         MCP Server（公网 HTTPS）
                  │
                  ▼
           业务 API / 数据库
```

授权流程：

1. Grok 请求 MCP URL。
2. MCP Server 返回未认证响应和 Protected Resource Metadata 地址。
3. Grok 读取 Protected Resource Metadata。
4. Grok 读取 Authorization Server Metadata。
5. Grok 生成 PKCE verifier 和 challenge。
6. 浏览器打开 Authorization Endpoint。
7. 用户完成认证和授权。
8. 授权服务器把短期、一次性授权码返回 Grok 固定回调地址。
9. Grok 使用授权码和 verifier 请求 Token Endpoint。
10. Grok 携带 Access Token 调用 MCP 工具。

## 8. 本地开发

1. 本地启动 Streamable HTTP MCP Server。
2. 使用 ngrok 或 Cloudflare Tunnel 暴露 HTTPS 地址。
3. 将公开地址配置为 OAuth issuer/resource URL。
4. 把公开 MCP URL 添加到 Grok Custom Connector。
5. 完成完整浏览器授权流程。

示例：

```bash
ngrok http 3000
```

隧道只解决公网可达性，不会自动实现 OAuth、PKCE、元数据或 Token 管理。

## 9. 与 Notion MCP 对比

| 项目 | Notion MCP | 自建 MCP 目标 |
|---|---|---|
| MCP URL | 固定官方地址 | 自有公网 HTTPS 地址 |
| 传输 | Streamable HTTP | Streamable HTTP |
| 授权 | OAuth + PKCE | OAuth + PKCE |
| OAuth 发现 | 标准元数据 | 标准元数据 |
| 客户端注册 | 官方预置或自动处理 | 固定客户端或 DCR |
| Token 管理 | MCP Client 负责 | MCP Client 负责 |
| 工具发现 | 自动 | 自动 |
| 用户体验 | 粘贴 URL → 授权 | 粘贴 URL → 授权 |

## 10. 本项目当前状态

本项目已经支持：

- Streamable HTTP MCP
- Authorization Code + S256 PKCE
- Authorization Server Metadata
- Protected Resource Metadata
- 固定 Grok Client ID
- 固定 Grok 官方回调地址
- 面向 Grok 官方回调地址的受限 Dynamic Client Registration
- 短期 Access Token
- 30 天 Refresh Token
- Refresh Token 原子轮换和重放检测
- `offline_access`
- 一次性授权码
- Bearer Token 和 scope 校验

当前没有实现：

- 面向任意第三方客户端的通用 Dynamic Client Registration
- 多用户登录、SSO 或 MFA
- Token 主动撤销

当前设计适合单所有者 Grok Connector。若目标是面向不特定客户端和多用户的公共 MCP 服务，应接入外部 IdP，并实现客户端注册、集中撤销和审计。

## 11. 快速检查清单

- [ ] MCP 使用 Streamable HTTP
- [ ] MCP URL 可通过公网 HTTPS 访问
- [ ] 提供 `/.well-known/oauth-protected-resource`
- [ ] 提供 `/.well-known/oauth-authorization-server`
- [ ] 支持 Authorization Code
- [ ] 强制 S256 PKCE
- [ ] 精确校验 Client ID 和 redirect URI
- [ ] 授权码短期有效且只能使用一次
- [ ] Access Token 校验 issuer、audience、类型和 scope
- [ ] OAuth 和 Token 响应禁用缓存
- [ ] 已通过真实 Grok Connector 完成端到端授权
- [ ] 需要长期会话时验证 Refresh Token 轮换和重放拒绝
- [ ] 需要任意客户端接入时再实现并保护 DCR

满足最低要求并通过真实 Grok 端到端测试后，用户即可获得接近 Notion 的体验：粘贴 MCP URL、完成一次浏览器授权，然后直接使用工具。

# 配置与部署文档

本文面向项目管理员，说明如何配置本地环境、OAuth 客户端、Vercel Blob 和生产部署。

## 1. 运行模型

当前项目是公开 OAuth Authorization Server：

- 用户在浏览器确认授权，不需要共享口令。
- MCP 客户端使用 OAuth Authorization Code + S256 PKCE 获取 Access Token。
- OAuth 客户端固定为 `grok`，并通过受限的动态注册端点自动返回给 Grok。
- 授权码有效期为 5 分钟，只能兑换一次。
- Access Token 有效期为 1 小时。
- Refresh Token 有效期为 30 天，每次刷新都会轮换且旧 Token 立即失效。

任何 Grok 用户都可以授权并调用全部公开工具。涉及私有数据、用户隔离或敏感写操作时，必须接入外部身份提供商。

## 2. 前置条件

- Node.js 20.9 或更高版本
- npm
- 一个连接到项目的私有 Vercel Blob Store
- 一个启用 HTTPS 的公开域名

生产环境不能省略 Blob。它负责授权码、Refresh Token 的一次性消费状态和公开页面。
生产构建会在缺少 Blob 凭证时直接失败。

## 3. 环境变量

### 最简单配置：Vercel + 已绑定 Blob + Grok

Vercel 自动推导服务域名，Blob 绑定自动注入存储凭证时，只需手工配置：

```dotenv
OAUTH_SECRET=至少32字符的独立随机密钥
```

其中：

- Client ID 固定为 `grok`，不用配置。
- Client Secret 留空。
- `MCP_RESOURCE_URL` 由 Vercel 自动推导，不用配置。
- `BLOB_READ_WRITE_TOKEN` 由 Blob 绑定自动注入，不用手工复制。
- Grok Client ID 和官方回调地址均已内置，不用配置。

生成签名密钥：

```bash
openssl rand -base64 48
```

### 高级配置：自定义域名或本地开发

```dotenv
OAUTH_SECRET=至少32字符的独立随机密钥
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
MCP_RESOURCE_URL=https://mcp.example.com
```

- 本地开发：通过 `vercel env pull .env.local` 获取 Blob 凭证。
- 使用自定义域名：填写 `MCP_RESOURCE_URL`。
- 部署在其他平台：填写公开的 `MCP_RESOURCE_URL` 和 Blob 读写凭证。

以下章节解释每个配置项。

### `MCP_RESOURCE_URL`

可选覆盖项。Vercel 部署会按以下顺序自动确定公开地址：

1. `MCP_RESOURCE_URL`
2. `VERCEL_PROJECT_PRODUCTION_URL`
3. `VERCEL_URL`

使用 Vercel 默认生产域名时不用配置。如果使用自定义域名，或在其他平台以生产模式运行，才设置该值；不包含结尾斜杠或 `/api/mcp`：

```dotenv
MCP_RESOURCE_URL=https://mcp.example.com
```

最终公开地址决定：

- OAuth issuer：`https://mcp.example.com`
- MCP resource audience：`https://mcp.example.com/api/mcp`
- 元数据中的授权和 Token 地址

改变该值后，旧 Access Token 会因 issuer 或 audience 不匹配而失效。

### `OAUTH_SECRET`

JWT HMAC 签名密钥，生产环境至少 32 个字符。建议生成 48 字节随机值：

```bash
openssl rand -base64 48
```

不要与 Blob Token 或其他服务密钥复用。轮换该值会立即使所有授权码、Access Token 和 Refresh Token 失效。

### Grok 客户端

项目内置且只支持固定 OAuth 公共客户端和回调地址。Grok 会通过 `/oauth/register` 自动取得该 Client ID，不需要用户手填：

```json
{
  "client_id": "grok",
  "client_name": "Grok",
  "redirect_uri": "https://grok.com/connectors-oauth-exchange-code/"
}
```

注意：

- `redirect_uri` 使用精确字符串匹配。
- 协议、域名、端口、路径和末尾斜杠都必须完全一致。
- 不支持通配符回调地址。
- Client ID 固定为 `grok`。
- 客户端使用 PKCE，因此 Client Secret 留空。

### Blob 存储变量

Vercel 绑定私有 Blob Store 后会注入 `BLOB_READ_WRITE_TOKEN`。它只供服务端使用，不应暴露给浏览器、MCP 客户端或提交到 Git。

## 4. 本地配置

安装依赖：

```bash
npm ci
```

复制环境变量：

```bash
cp .env.example .env.local
```

本地开发需要拉取已连接 Blob Store 的开发环境变量。非生产开发默认地址是 `http://localhost:3000`，无需设置 `MCP_RESOURCE_URL`。

```bash
npm run dev
```

可检查：

```bash
curl http://localhost:3000/.well-known/oauth-authorization-server
curl http://localhost:3000/.well-known/oauth-protected-resource
```

## 5. Vercel 部署

1. 将仓库导入 Vercel。
2. 在 Storage 创建或绑定私有 Vercel Blob Store。
3. 在 Project Settings → Environment Variables 配置本文全部必需变量。
4. 使用 Vercel 默认域名时不要配置 `MCP_RESOURCE_URL`。
5. 部署。
6. 如果之后绑定自定义域名，再将 `MCP_RESOURCE_URL` 设置为该域名并重新部署。

部署前执行：

```bash
npm test
npm run check
npm run build
npm audit --omit=dev
```

## 6. 客户端配置

推荐让客户端读取 OAuth 元数据：

| 配置项 | 值 |
|---|---|
| MCP Server URL | `https://你的域名/api/mcp` |
| Authorization Server Metadata | `https://你的域名/.well-known/oauth-authorization-server` |
| Protected Resource Metadata | `https://你的域名/.well-known/oauth-protected-resource` |
| Client ID | `grok` |
| Client Secret | 留空 |
| Scope | `mcp:tools` |
| PKCE | S256 |

如果客户端不支持元数据发现，可以手工填写：

| 端点 | URL |
|---|---|
| Authorization Endpoint | `https://你的域名/oauth/authorize` |
| Token Endpoint | `https://你的域名/oauth/token` |

首次连接时，浏览器会打开授权页。确认客户端 ID 和 scope 后点击“确认授权”。

## 7. 上线验证

检查授权服务器元数据：

```bash
curl -fsS https://你的域名/.well-known/oauth-authorization-server
```

检查受保护资源元数据：

```bash
curl -fsS https://你的域名/.well-known/oauth-protected-resource
```

确认未认证 MCP 请求被拒绝：

```bash
curl -i https://你的域名/api/mcp
```

预期返回 `401`，且不应接受旧版 Demo Token：

```bash
curl -i -H 'Authorization: Bearer demo-anything' https://你的域名/api/mcp
```

完整授权流程应通过实际 MCP 客户端验证，因为 PKCE verifier 由客户端生成和保存。

## 8. 常见问题

### `invalid_client`

Client ID 不是 `grok`，或 `redirect_uri` 不是内置的 `https://grok.com/connectors-oauth-exchange-code/`。末尾斜杠也必须一致。

### `invalid_scope`

客户端请求了未支持的 scope。当前支持：

- `mcp:tools`
- `mcp:read`
- `mcp:write`
- `openid`
- `offline_access`

MCP 入口当前只强制要求 `mcp:tools`。

### `invalid_grant`

可能原因：

- 授权码已过期。
- 授权码已兑换。
- PKCE verifier 错误。
- Client ID 或回调地址与授权请求不一致。
- `OAUTH_SECRET` 在授权过程中发生轮换。

重新发起完整授权流程，不要重试旧授权码。

### `server_error`

响应会包含“检查 Vercel Blob 绑定”的说明。检查部署日志及：

- `OAUTH_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- Blob Store 是否连接到当前项目和当前环境

## 9. 运维注意事项

- 不要记录 Authorization header、授权码或 Blob Token。
- 为生产、预发布和开发环境使用不同的 OAuth 密钥和 Blob Store。
- 在部署平台开启 HTTPS、访问日志和错误告警。
- 轮换 `OAUTH_SECRET` 前应接受现有 Token 全部失效。
- 如需让已有 Access Token 和 Refresh Token 全部失效，应轮换 `OAUTH_SECRET`。

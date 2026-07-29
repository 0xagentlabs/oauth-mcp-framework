# 部署说明

本文只说明如何通过 GitHub 和 Vercel 网页控制台完成生产部署。

## 1. 准备

- 将本仓库放在自己的 GitHub 账号或组织下。
- 准备一个 Vercel 账号。
- 准备一个至少 32 字符的独立随机字符串作为 `OAUTH_SECRET`。

`OAUTH_SECRET` 用于签署 OAuth 授权码和 Token。不要复用其他密钥，不要提交到 Git。

## 2. 导入项目

1. 登录 Vercel Dashboard。
2. 点击 **Add New → Project**。
3. 选择保存本项目的 GitHub 仓库，点击 **Import**。
4. Framework Preset 保持自动识别的 **Next.js**。
5. 在 **Environment Variables** 中添加：

   | Name | Value | Environment |
   |---|---|---|
   | `OAUTH_SECRET` | 至少 32 字符的独立随机值 | Production、Preview、Development |

6. 点击 **Deploy**。

首次构建可能提示 `Vercel Blob storage is required in production`。这是预期现象：先完成下一节的 Blob 绑定，再重新部署。

## 3. 创建并连接 Blob Store

1. 打开刚创建的 Vercel Project。
2. 进入 **Storage**。
3. 点击 **Create Database**，选择 **Blob**。
4. 创建一个 **Private** Blob Store。
5. 将 Store 连接到当前项目的 Production、Preview 和 Development 环境。
6. 打开项目的 **Settings → Environment Variables**，确认已经出现 Blob 连接自动注入的凭证。

Blob Store 用于保存：

- 授权码的一次性消费状态；
- Refresh Token 的轮换和重放防护状态；
- `publish_page` 发布的页面。

不要手工把 Blob 凭证写进源码或提交到 Git。

## 4. 重新部署

1. 打开项目的 **Deployments**。
2. 找到最新部署，打开右侧菜单。
3. 点击 **Redeploy**。
4. 等待状态变为 **Ready**。

使用 Vercel 默认生产域名时，无需配置 `MCP_RESOURCE_URL`。

## 5. 可选：绑定自定义域名

1. 打开 **Settings → Domains**。
2. 添加自定义域名，并按页面提示完成 DNS 配置。
3. 在 **Settings → Environment Variables** 添加：

   ```dotenv
   MCP_RESOURCE_URL=https://mcp.example.com
   ```

4. 仅勾选实际使用该域名的环境。
5. 重新部署。

值必须是 HTTPS 根地址，不能带末尾 `/`，也不能包含 `/api/mcp`。修改后，旧 Token 会因 issuer 或 audience 变化而失效，用户需要重新授权。

## 6. 上线验收

在浏览器中依次打开：

```text
https://你的域名/.well-known/oauth-authorization-server
https://你的域名/.well-known/oauth-protected-resource/api/mcp
```

两个地址都应返回 JSON。

然后直接打开：

```text
https://你的域名/api/mcp
```

未授权请求应返回 `401`，这是正确结果。

最后在 Grok 中：

1. 打开 **Connectors**。
2. 新建 **Custom Connector**。
3. Server URL 只填写：

   ```text
   https://你的域名/api/mcp
   ```

4. 保存并完成浏览器授权。
5. 确认 Grok 能发现并调用 MCP 工具，且不要求填写 Client Secret。

## 7. 可选：私有 MCP

当前默认模式是公开授权：任何能访问服务的人都可以在授权页确认并取得 Token。隐藏域名或 MCP URL 不能形成访问控制。

### 单所有者模式

适合个人服务或少量可信使用者：

1. 打开 Vercel Project 的 **Settings → Environment Variables**。
2. 添加：

   | Name | Value | Environment |
   |---|---|---|
   | `MCP_AUTH_PASSWORD` | 至少 16 个字符的独立随机密码 | Production |

3. 在 **Deployments** 页面重新部署。
4. 删除 Grok 中的旧连接并重新授权。
5. 授权页出现“私有访问密码”后，输入该密码完成授权。

未配置 `MCP_AUTH_PASSWORD` 时保持公开模式。密码只在授权时使用，不会写入授权码或 Token。轮换密码会阻止新的未授权连接，但不会撤销已经签发的 Token；如需同时撤销已有连接，应一并轮换 `OAUTH_SECRET`。

### 多用户私有服务

共享密码不能提供用户身份、独立撤销、角色权限或审计。存在这些需求时，不应继续扩展共享密码模式，应接入支持 OIDC/OAuth 的身份提供商：

1. 用户进入授权页时先登录身份提供商。
2. 服务端验证登录 Session，并检查允许的用户、组织或邮箱域。
3. 将已验证的用户 ID 写入授权码和 Access Token 的 `sub`。
4. MCP 工具按 `authInfo.extra.userId` 约束数据查询。
5. 在身份提供商和业务层实现禁用用户、角色权限和审计。

Grok 是云端客户端，因此纯内网地址通常无法直接连接。若使用网络级私有访问，还需确保 Grok 能访问公开 HTTPS 入口；不要仅通过 IP 白名单假定浏览器授权流和 MCP 请求来自同一地址。

## 8. 最小配置速查

| 配置项 | 是否手工配置 | 值 |
|---|---|---|
| `OAUTH_SECRET` | 是 | 至少 32 字符的独立随机值 |
| Private Blob Store | 是 | 在 Storage 中创建并连接 |
| `BLOB_READ_WRITE_TOKEN` | 否 | Blob 连接自动注入 |
| `MCP_RESOURCE_URL` | 默认域名：否；自定义域名：是 | 服务的 HTTPS 根地址 |
| `MCP_AUTH_PASSWORD` | 仅单所有者私有模式 | 至少 16 个随机字符 |
| Client ID | 否 | 内置 `grok` |
| Client Secret | 否 | 留空 |
| Redirect URI | 否 | 已内置 Grok 官方回调地址 |

## 9. 常见问题

### 配置诊断

先在 Vercel Project 的 **Settings → Environment Variables** 中检查配置。修改任何环境变量后，都必须到 **Deployments** 页面重新部署；只保存变量不会改变已经运行的部署。

| 现象或错误 | 原因 | 正确配置 |
|---|---|---|
| `OAUTH_SECRET must be at least 32 characters in production` | 未配置或长度不足 | 添加 `OAUTH_SECRET`，值至少 32 个字符 |
| `Vercel Blob storage is required in production` | Blob 未创建、未连接或没有连接到当前环境 | 创建 Private Blob Store，并连接当前 Project 和目标环境 |
| `MCP_AUTH_PASSWORD must be at least 16 characters in production` | 私有模式密码过短 | 改为至少 16 个字符；不需要私有模式则删除该变量 |
| 授权页没有密码输入框 | `MCP_AUTH_PASSWORD` 未配置到当前部署环境，或修改后没有重新部署 | 检查变量的 Environment，并重新部署 |
| 输入正确密码仍然 `access_denied` | 密码值、环境或部署版本不一致 | 重新保存变量并重新部署，不要在值前后添加空格 |
| 授权后 MCP 持续返回 `401` | 域名、issuer 或旧 Token 不一致 | 检查 `MCP_RESOURCE_URL`，删除旧连接后重新授权 |
| OAuth 端点生成了 Preview 域名 | `MCP_RESOURCE_URL` 未设置或设置到了错误环境 | 自定义域名部署时，将它设为生产 HTTPS 根地址 |
| `server_error` / `temporarily_unavailable` | Blob 凭证不可用或 Store 未连接 | 检查 Storage 连接状态和目标环境 |

#### 必需配置

```dotenv
OAUTH_SECRET=至少32字符的独立随机值
```

还必须在 Vercel Storage 中连接一个 **Private Blob Store**。Blob 凭证由连接自动注入，不要自行复制，也不要在 Git 中创建真实 `.env` 文件。

#### 可选配置

```dotenv
# 仅自定义域名需要；不能带末尾 / 或 /api/mcp
MCP_RESOURCE_URL=https://mcp.example.com

# 仅单所有者私有模式需要；至少 16 个字符
MCP_AUTH_PASSWORD=独立的私有访问密码
```

不要把 `OAUTH_SECRET` 和 `MCP_AUTH_PASSWORD` 设置成相同值：前者是服务端 Token 签名密钥，后者是用户在授权页输入的访问密码。

#### 环境范围

每个变量都要检查右侧的 Environment：

- 正式域名使用 **Production**。
- Preview 部署使用 **Preview**。
- 本地或开发部署使用 **Development**。

变量只配置在 Development 时，Production 部署仍会视为未配置。Blob Store 也必须连接到实际使用的同一环境。

#### 修改后的验证顺序

1. 在 **Settings → Environment Variables** 确认变量名称和值。
2. 在 **Storage** 确认 Private Blob Store 已连接到当前 Project。
3. 在 **Deployments** 对最新版本执行 **Redeploy**。
4. 打开服务首页，查看“配置检测”是否显示全部正常。检测结果只显示状态，不显示密钥。
5. 打开 `/.well-known/oauth-authorization-server`，确认返回 JSON 且 URL 使用预期域名。
6. 打开 `/.well-known/oauth-protected-resource/api/mcp`，确认 `resource` 是 `https://你的域名/api/mcp`。
7. 删除客户端中的旧连接，重新完成 OAuth 授权。

### 构建提示缺少 Blob

确认 Private Blob Store 已连接到当前项目和目标环境，然后在 Deployments 页面重新部署。

### `invalid_client`

当前服务只接受内置 Client ID `grok` 和 Grok 官方回调地址。

### `invalid_scope`

MCP 调用必须包含 `mcp:tools`。不要在客户端填写项目未声明的 scope。

### `invalid_grant`

授权码可能已经过期、使用过，或 PKCE 校验失败。删除旧连接并重新发起完整授权，不要重复提交旧授权码。

### 授权后仍返回 `401`

检查生产域名是否与 `MCP_RESOURCE_URL` 一致。若刚修改密钥或域名，旧 Token 已失效，需要重新授权。

### 撤销所有现有授权

在 Vercel 的 Environment Variables 中替换 `OAUTH_SECRET`，然后重新部署。全部现有授权码、Access Token 和 Refresh Token 都会失效。

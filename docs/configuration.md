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
- Refresh Token 的轮换和重放防护状态。

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

## 7. 最小配置速查

| 配置项 | 是否手工配置 | 值 |
|---|---|---|
| `OAUTH_SECRET` | 是 | 至少 32 字符的独立随机值 |
| Private Blob Store | 是 | 在 Storage 中创建并连接 |
| `BLOB_READ_WRITE_TOKEN` | 否 | Blob 连接自动注入 |
| `MCP_RESOURCE_URL` | 默认域名：否；自定义域名：是 | 服务的 HTTPS 根地址 |
| Client ID | 否 | 内置 `grok` |
| Client Secret | 否 | 留空 |
| Redirect URI | 否 | 已内置 Grok 官方回调地址 |

## 8. 常见问题

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

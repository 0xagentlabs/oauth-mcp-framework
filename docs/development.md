# 二次开发

## 目录

```text
src/
├── app/api/[transport]/route.ts       # MCP 工具与鉴权入口
├── app/oauth/authorize/route.ts       # 授权页和授权码
├── app/oauth/register/route.ts        # Grok 动态注册
├── app/oauth/token/route.ts           # Token 签发与刷新
└── lib/
    ├── auth.ts                        # Bearer Token → MCP AuthInfo
    ├── blob-store.ts                  # 一次性状态
    └── oauth.ts                       # OAuth 校验与 JWT
```

## 添加工具

工具注册在 `src/app/api/[transport]/route.ts`：

```ts
server.tool(
  "get_order",
  "Returns one order.",
  { orderId: z.string().min(1).max(100) },
  async ({ orderId }, { authInfo }) => {
    const userId = authInfo?.extra?.userId;
    if (typeof userId !== "string") {
      return { isError: true, content: [{ type: "text", text: "Unauthorized" }] };
    }

    const order = await getOrderForUser(orderId, userId);
    return {
      content: [{ type: "text", text: order ? JSON.stringify(order) : "Not found" }],
      isError: !order,
    };
  },
);
```

要求：

- 所有外部参数用 Zod 限制类型、长度和格式。
- 查询必须绑定 `authInfo` 中的用户或租户，不能只相信客户端提交的资源 ID。
- 不向客户端返回密钥、内部错误、路径或调用栈。
- 删除、付款、发送消息等操作需要业务确认或幂等键。
- 服务端密钥只放部署平台环境变量。

只有多个工具复用同一逻辑时，才提取新的业务模块；单个工具不需要注册器、工厂或接口层。

## OAuth 调用链

```text
/oauth/authorize
  → 校验 client_id、redirect_uri、scope、S256 PKCE
  → 用户确认
  → 创建 5 分钟授权码并在 Blob 记录

/oauth/token
  → 校验授权码和 PKCE
  → 原子消费 Blob 状态
  → 签发 Access Token 和轮换 Refresh Token

/api/mcp
  → 校验 Bearer Token 的签名、issuer、audience、typ
  → 检查 mcp:tools
  → 执行工具
```

OAuth 校验应保留在共享入口，不要复制到每个工具。

## 修改权限

Scope 由 `src/lib/oauth.ts` 的 `SCOPES` 声明，MCP 必需权限由路由中的 `requiredScopes` 指定。修改时同时确认：

- 授权服务器和受保护资源元数据会暴露正确的 scope；
- Access Token 携带所请求的 scope；
- MCP 入口或具体工具强制执行对应权限；
- 测试覆盖拒绝分支。

## 多用户

当前授权页只是公开确认页，Token 主体统一为 `resource-owner`，不提供真实用户身份。

需要私有数据、多用户隔离、SSO、MFA 或审计时，应接入成熟身份提供商，并在授权码和 Access Token 中使用已验证的用户 ID。不要通过在授权表单增加用户名字段来模拟登录。

## 安全不变量

修改 OAuth 核心时必须保持：

- 生产环境拒绝短密钥和缺失 Blob 配置；
- Client ID 与回调地址精确匹配；
- 只允许 Authorization Code、Refresh Token 和 S256 PKCE；
- 授权码短期有效且只能使用一次；
- Refresh Token 单次使用并轮换；
- Token 校验 issuer、audience、类型和 scope；
- OAuth 响应不缓存；
- 错误响应不泄露内部异常。

## 验证

```bash
npm test
npm run check
npm run build
```

新增安全分支、解析逻辑或有副作用的工具时，至少增加一个能在回归时失败的测试。现有测试使用 Node.js 内置 `node:test`，不需要新增测试框架。

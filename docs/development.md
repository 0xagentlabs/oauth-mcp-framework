# 二次开发文档

本文面向在当前项目上增加 MCP 工具、业务服务或认证能力的开发者。

## 1. 技术栈

- Next.js App Router
- TypeScript
- `mcp-handler`
- `@modelcontextprotocol/sdk`
- `jose`
- `zod`
- Redis 兼容 REST KV

项目没有数据库 ORM、依赖注入容器或自定义框架。二次开发应优先延续这一结构。

## 2. 目录结构

```text
src/
├── app/
│   ├── api/[transport]/route.ts
│   ├── oauth/
│   │   ├── authorize/route.ts
│   │   └── token/route.ts
│   ├── .well-known/
│   │   ├── oauth-authorization-server/route.ts
│   │   └── oauth-protected-resource/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── auth.ts
│   └── oauth.ts
└── test/
    └── oauth.test.ts
```

职责：

- `api/[transport]/route.ts`：创建 MCP Server、注册工具、应用 scope 鉴权。
- `lib/auth.ts`：将 Bearer Token 转换为 MCP `AuthInfo`。
- `lib/oauth.ts`：客户端、scope、PKCE、JWT、授权码存储和限流。
- `oauth/authorize`：校验授权请求并展示管理员授权表单。
- `oauth/token`：校验并原子消费授权码，签发 Access Token。
- `.well-known`：OAuth 客户端自动发现所需元数据。

## 3. 请求调用链

### OAuth

```text
客户端构造 PKCE
  → GET /oauth/authorize
  → 校验 client_id、redirect_uri、scope、S256
  → 管理员 POST 授权口令
  → KV 限流
  → 签发 5 分钟 JWT 授权码，并把 jti 写入 KV
  → 客户端 POST /oauth/token
  → 校验客户端、JWT、PKCE
  → KV GETDEL 原子消费 jti
  → 签发 1 小时 Access Token
```

### MCP

```text
客户端请求 /api/mcp
  → withMcpAuth
  → verifyToken
  → 校验 JWT issuer、audience、typ
  → 检查 mcp:tools scope
  → 执行 MCP tool
```

安全校验应留在这些共享边界，不要在每个工具内重复实现 Token 校验。

## 4. 添加 MCP Tool

工具统一注册在 `src/app/api/[transport]/route.ts`。最小示例：

```ts
server.tool(
  "get_order",
  "Returns one order visible to the authenticated user.",
  {
    orderId: z.string().min(1).max(100),
  },
  async ({ orderId }, { authInfo }) => {
    const userId = authInfo?.extra?.userId;
    if (typeof userId !== "string") {
      return {
        isError: true,
        content: [{ type: "text", text: "Authenticated user is required" }],
      };
    }

    const order = await getOrderForUser(orderId, userId);
    if (!order) {
      return {
        isError: true,
        content: [{ type: "text", text: "Order not found" }],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(order) }],
    };
  },
);
```

开发要求：

- 所有外部参数用 Zod 限制类型、长度和格式。
- 数据访问必须绑定 `authInfo` 中的主体，不能只按客户端传入的资源 ID 查询。
- 不向客户端返回数据库错误、密钥、内部路径或调用栈。
- 有副作用的工具应在描述和返回结果中明确行为。
- 对删除、付款、发送消息等重要操作增加业务级确认或幂等键。
- 不把 Access Token 传给下游日志、提示词或第三方 API。

如果工具数量明显增加，再按业务域拆成普通函数：

```text
src/lib/orders.ts
src/lib/customers.ts
```

不要为单个工具预先创建注册器、工厂或接口层。

## 5. 使用认证信息

`verifyToken` 当前产生：

```ts
{
  token: string,
  clientId: string,
  scopes: string[],
  extra: {
    userId: string | undefined,
    mode: "oauth"
  }
}
```

当前统一授权模型默认主体为 `resource-owner`。它只能表达一个资源所有者，不能表达真实的多用户身份。

如需在 TypeScript 中避免 `any`，可在业务模块定义最小检查函数：

```ts
function authenticatedUser(authInfo: AuthInfo | undefined): string {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== "string") throw new Error("unauthorized");
  return userId;
}
```

只有多个工具都需要该逻辑时才提取共享函数。

## 6. 增加或调整 Scope

Scope 同时影响三处：

1. `src/lib/oauth.ts` 中的 `SCOPES`
2. MCP 入口 `requiredScopes`
3. OAuth 元数据返回的 `scopes_supported`

元数据会自动读取 `SCOPES`，因此通常只需要修改前两处。

例如把整个 MCP 服务改为要求读权限：

```ts
const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["mcp:read"],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});
```

当前 `withMcpAuth` 在路由级统一检查 scope。如果不同工具需要不同权限，应在工具执行前检查 `authInfo.scopes`，并为每个权限分支增加测试。

## 7. 接入业务 API

服务端密钥应放入部署平台环境变量，例如：

```dotenv
ORDERS_API_URL=https://orders.internal.example
ORDERS_API_TOKEN=...
```

调用下游时设置超时并处理非成功状态：

```ts
const response = await fetch(`${process.env.ORDERS_API_URL}/orders/${encodeURIComponent(orderId)}`, {
  headers: { Authorization: `Bearer ${process.env.ORDERS_API_TOKEN}` },
  signal: AbortSignal.timeout(10_000),
  cache: "no-store",
});

if (!response.ok) {
  throw new Error(`Orders API failed with ${response.status}`);
}
```

返回给 MCP 客户端时应转换成稳定的公开错误，详细错误只进入经过脱敏的服务端日志。

## 8. 接入数据库

只有业务工具需要持久数据时才增加数据库。OAuth 授权码继续留在 Redis，因为它依赖短 TTL 和原子 `GETDEL`。

数据库访问的最低要求：

- 所有查询参数化。
- 查询必须包含租户或用户边界。
- 写操作使用数据库约束保证唯一性和幂等性。
- 密钥仅使用服务端环境变量。
- 不在 MCP 返回中直接序列化完整数据库对象。

## 9. 改造成多用户认证

当前统一授权口令不适合多用户。需要多用户时，建议由成熟 IdP 负责：

- 登录和 MFA
- Session
- 用户同意
- Token 签发或 Token Exchange
- 密钥轮换与 JWKS
- 撤销、审计和账户恢复

推荐改造边界：

1. 用 IdP 登录/Session 替换 `verifyAuthorizationPassword`。
2. 在授权码中写入真实用户 ID。
3. 用 IdP JWKS 或内部签名服务替换共享 HMAC。
4. `verifyToken` 从已验证 Token 中映射用户和 scope。
5. 保留客户端、回调 URI、PKCE 和一次性授权码校验。

不要只把用户名字段添加到当前表单；那不会形成可信用户身份。

## 10. 修改 OAuth 核心时的安全不变量

任何 OAuth 改动都必须保持：

- 生产环境不能使用默认签名密钥。
- 只接受已登记客户端和精确回调地址。
- 只接受允许的 scope。
- 只接受 Authorization Code 流程和 S256 PKCE。
- 授权码短期有效、绑定客户端和回调地址、只能使用一次。
- Token 校验 issuer、audience 和 `typ`。
- MCP 路由要求明确 scope。
- OAuth 和 Token 响应不缓存。
- 错误响应不泄露内部异常。

不要为了本地调试重新添加静态 Bearer Token 或 `demo-*` 通配规则。

## 11. 测试

运行全部检查：

```bash
npm test
npm run check
npm run build
npm audit --omit=dev
```

测试使用 Node.js 内置 `node:test`，不需要额外测试框架。现有测试覆盖：

- 非法 scope 和回调地址
- PKCE verifier
- 授权口令
- 授权限流
- 非签名 Demo Token
- 合法 Access Token
- 授权码重复消费

新增安全分支、解析器、循环或业务写操作时，至少增加一个会在逻辑回归时失败的测试。测试文件放在 `test/*.test.ts`。

涉及真实 Redis 或完整 OAuth 跳转时，应另加部署后的集成测试；不要把生产 KV Token 写入仓库。

## 12. 提交前检查

```bash
git diff --check
npm test
npm run check
npm run build
npm audit --omit=dev
```

检查最终差异时重点确认：

- `.env`、Token、口令和服务密钥没有进入 Git。
- 没有新增认证绕过或默认生产凭据。
- 新工具的参数和资源访问边界均被校验。
- README、配置文档和元数据仍与实际实现一致。

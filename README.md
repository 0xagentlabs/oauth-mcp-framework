# OAuth MCP Framework

Minimal MCP server for a single-owner production deployment, using OAuth authorization code flow, S256 PKCE and one-time authorization codes.

## Documentation

- [配置与部署文档](docs/configuration.md)
- [二次开发文档](docs/development.md)
- [Grok 自动 OAuth MCP 接入指南](docs/grok-auto-oauth.md)

## Security model

- MCP access requires a signed, audience-bound access token with `mcp:tools`.
- The built-in `grok` client uses Grok's fixed callback URL.
- Users confirm the public authorization request in the browser; no shared password is required.
- Authorization codes expire after five minutes and are consumed atomically in Redis-compatible KV.
- Access tokens expire after one hour; rotating refresh tokens keep the connection active for up to 30 days.
- Grok obtains the fixed public Client ID automatically through a restricted Dynamic Client Registration endpoint.

This is a public MCP authorization server. Anyone with a Grok account can authorize and use all exposed tools. Add an external identity provider before exposing private data or sensitive operations.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2F0xagentlabs%2Foauth-mcp-framework&env=OAUTH_SECRET&envDescription=OAuth%20signing%20secret&envLink=https%3A%2F%2Fgithub.com%2F0xagentlabs%2Foauth-mcp-framework%2Fblob%2Fmain%2Fdocs%2Fconfiguration.md&project-name=oauth-mcp-framework&repository-name=oauth-mcp-framework)

The deployment form asks for:

| Variable | Value |
|---|---|
| `OAUTH_SECRET` | Independent random value with at least 32 characters |

Generate the signing secret locally:

```bash
openssl rand -base64 48
```

### Add Redis storage

After creating the Vercel project:

1. Open the project in Vercel.
2. Go to **Storage** → **Create Database**, or install [Upstash Redis from Vercel Marketplace](https://vercel.com/marketplace/upstash).
3. Connect the Redis database to this project and all required environments.
4. Confirm that Vercel injected either variable pair:

   | Supported pair | Variables |
   |---|---|
   | Vercel KV naming | `KV_REST_API_URL`, `KV_REST_API_TOKEN` |
   | Upstash naming | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

5. Redeploy the project after connecting storage.

Redis is required for one-time authorization codes and authorization rate limiting. `MCP_RESOURCE_URL` is inferred automatically from Vercel; configure it only when using a custom domain override.

Verify the deployment:

```bash
curl -fsS https://YOUR_DOMAIN/.well-known/oauth-authorization-server
curl -fsS https://YOUR_DOMAIN/.well-known/oauth-protected-resource
```

See [配置与部署文档](docs/configuration.md) for minimal and advanced configurations.

## Endpoints

| Endpoint | Path |
|---|---|
| MCP | `/api/mcp` |
| Authorization | `/oauth/authorize` |
| Token | `/oauth/token` |
| Dynamic client registration | `/oauth/register` |
| Authorization server metadata | `/.well-known/oauth-authorization-server` |
| Protected resource metadata | `/.well-known/oauth-protected-resource` |

## Built-in tools

- `hello`
- `get_server_time`
- `echo`
- `whoami`
- `publish_page` – publish a permanent public text page and return its URL

Replace these examples with the actual tools your server should expose.

## Local development

Copy `.env.example` to `.env.local`, use a development Redis database, update the public URL and configured redirect URI, then run:

```bash
npm install
npm run dev
```

## License

MIT

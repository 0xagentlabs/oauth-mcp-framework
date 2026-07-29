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
- Authorization codes expire after five minutes and are consumed once using private Vercel Blob markers.
- Access tokens expire after one hour; rotating refresh tokens keep the connection active for up to 30 days.
- Grok obtains the fixed public Client ID automatically through a restricted Dynamic Client Registration endpoint.

This is a public MCP authorization server. Anyone with a Grok account can authorize and use all exposed tools. Add an external identity provider before exposing private data or sensitive operations.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2F0xagentlabs%2Foauth-mcp-framework&env=OAUTH_SECRET&envDescription=OAuth%20signing%20secret&envLink=https%3A%2F%2Fgithub.com%2F0xagentlabs%2Foauth-mcp-framework%2Fblob%2Fmain%2Fdocs%2Fconfiguration.md&project-name=oauth-mcp-framework&repository-name=oauth-mcp-framework)

### Minimum production configuration

| Item | Configuration |
|---|---|
| OAuth signing key | Set `OAUTH_SECRET` to an independent random value of at least 32 characters |
| Durable storage | Connect one **Private Vercel Blob Store** to the project |

Generate the signing secret locally:

```bash
openssl rand -base64 48
```

Vercel automatically injects `BLOB_READ_WRITE_TOKEN` after the Blob Store is connected. Do not copy it into source code or Git.

The following values are built in or inferred and normally must not be configured:

- Client ID: `grok`
- Client Secret: none
- Grok redirect URI: fixed in code
- `MCP_RESOURCE_URL`: inferred from the Vercel production URL
- Redis/KV: not used

### Deploy-button workflow

1. Click **Deploy with Vercel** and set `OAUTH_SECRET`.
2. Open the created Vercel project.
3. Go to **Storage** → **Create Database** → **Blob**.
4. Create a **Private** Blob Store and connect it to Production, Preview and Development.
5. Redeploy the project.

The deploy button cannot create the Blob Store. The first build may therefore fail with `Vercel Blob storage is required in production`; after connecting Blob and redeploying, the build should pass.

### Vercel CLI workflow

```bash
vercel link
vercel env add OAUTH_SECRET production
vercel blob create-store oauth-state \
  --access private \
  --yes \
  --environment production \
  --environment preview \
  --environment development
vercel --prod
```

If a Store is already connected, do not create another one. Check first:

```bash
vercel blob list-stores
vercel env ls
```

Blob stores one-time OAuth markers, Refresh Token rotation state and published pages.

### Advanced configuration

Only set `MCP_RESOURCE_URL` when using a custom domain or a non-Vercel host:

```dotenv
OAUTH_SECRET=at-least-32-random-characters
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
MCP_RESOURCE_URL=https://mcp.example.com
```

On Vercel, leave `BLOB_READ_WRITE_TOKEN` to the Storage integration. After changing `MCP_RESOURCE_URL`, existing OAuth tokens become invalid because their issuer and audience change.

Verify the deployment:

```bash
curl -fsS https://YOUR_DOMAIN/.well-known/oauth-authorization-server
curl -fsS https://YOUR_DOMAIN/.well-known/oauth-protected-resource/api/mcp
curl -i https://YOUR_DOMAIN/api/mcp
```

The final command must return `401` with a `WWW-Authenticate` header pointing to the protected-resource metadata.

Then add `https://YOUR_DOMAIN/api/mcp` as a Grok Custom Connector. Grok should discover OAuth automatically, open the browser confirmation page and return without asking for a Client Secret.

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

Connect the Blob Store to Development, then:

```bash
npm install
vercel link
vercel env pull .env.local
# Add a local OAUTH_SECRET with at least 32 characters to .env.local
npm run dev
```

`.env.local` is ignored by Git. `vercel env pull` overwrites that file, so add the local `OAUTH_SECRET` after pulling.

## License

MIT

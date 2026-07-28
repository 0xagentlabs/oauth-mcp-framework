# OAuth MCP Framework

Minimal MCP server for a single-owner production deployment, using OAuth authorization code flow, S256 PKCE and one-time authorization codes.

## Documentation

- [配置与部署文档](docs/configuration.md)
- [二次开发文档](docs/development.md)

## Security model

- MCP access requires a signed, audience-bound access token with `mcp:tools`.
- The built-in `grok` client uses the exact redirect URI configured in `GROK_REDIRECT_URI`.
- The resource owner approves connections with `OAUTH_AUTHORIZATION_PASSWORD`.
- Authorization codes expire after five minutes and are consumed atomically in Redis-compatible KV.
- The OAuth client ID is fixed to `grok`; dynamic client registration is not exposed.

This is a single-owner authorization server. Use an external identity provider instead if you need multiple users, SSO, account recovery, MFA, or per-user consent.

## Production deployment

1. Create a Vercel KV or Upstash Redis database.
2. Configure every variable shown in `.env.example`.
3. Set `GROK_REDIRECT_URI` to the exact callback URI shown by Grok.
4. Generate independent secrets:

   ```bash
   openssl rand -base64 48
   ```

5. Deploy and verify:

   ```bash
   npm ci
   npm test
   npm run check
   npm run build
   ```

## Endpoints

| Endpoint | Path |
|---|---|
| MCP | `/api/mcp` |
| Authorization | `/oauth/authorize` |
| Token | `/oauth/token` |
| Authorization server metadata | `/.well-known/oauth-authorization-server` |
| Protected resource metadata | `/.well-known/oauth-protected-resource` |

## Built-in tools

- `hello`
- `get_server_time`
- `echo`
- `whoami`

Replace these examples with the actual tools your server should expose.

## Local development

Copy `.env.example` to `.env.local`, use a development Redis database, update the public URL and configured redirect URI, then run:

```bash
npm install
npm run dev
```

## License

MIT

# OAuth MCP Framework

Minimal MCP server for a single-owner production deployment, using OAuth authorization code flow, S256 PKCE and one-time authorization codes.

## Security model

- MCP access requires a signed, audience-bound access token with `mcp:tools`.
- Clients and exact redirect URIs must be configured in `OAUTH_CLIENTS` or registered explicitly.
- The resource owner approves connections with `OAUTH_AUTHORIZATION_PASSWORD`.
- Authorization codes expire after five minutes and are consumed atomically in Redis-compatible KV.
- Dynamic client registration is disabled by default.

This is a single-owner authorization server. Use an external identity provider instead if you need multiple users, SSO, account recovery, MFA, or per-user consent.

## Production deployment

1. Create a Vercel KV or Upstash Redis database.
2. Configure every variable shown in `.env.example`.
3. Replace the sample callback in `OAUTH_CLIENTS` with the exact callback URI sent by your MCP client.
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

Never enable dynamic registration unless arbitrary public clients are expected. If enabled, add platform-level rate limiting to `/oauth/register`.

## Endpoints

| Endpoint | Path |
|---|---|
| MCP | `/api/mcp` |
| Authorization | `/oauth/authorize` |
| Token | `/oauth/token` |
| Dynamic registration (optional) | `/oauth/register` |
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

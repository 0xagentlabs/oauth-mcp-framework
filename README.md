# OAuth MCP Framework

Secure **Model Context Protocol (MCP)** server with **OAuth 2.1 + PKCE**, designed for [Grok Custom Connectors](https://grok.com/connectors) and other MCP clients.

Deployed on Vercel · Streamable HTTP · One-click style authorization page

## Live Demo

| Endpoint | URL |
|----------|-----|
| MCP | https://oauth-mcp-framework.vercel.app/api/mcp |
| Authorize | https://oauth-mcp-framework.vercel.app/oauth/authorize |
| Token | https://oauth-mcp-framework.vercel.app/oauth/token |
| AS Metadata | https://oauth-mcp-framework.vercel.app/.well-known/oauth-authorization-server |
| RS Metadata | https://oauth-mcp-framework.vercel.app/.well-known/oauth-protected-resource |

## Connect to Grok

1. Open [grok.com/connectors](https://grok.com/connectors)
2. **New Connector → Custom**
3. Fill in:

| Field | Value |
|-------|-------|
| Server URL | `https://oauth-mcp-framework.vercel.app/api/mcp` |
| Client ID | `grok` |
| Client Secret | *(leave empty)* |
| Authorization Endpoint | `https://oauth-mcp-framework.vercel.app/oauth/authorize` |
| Token Endpoint | `https://oauth-mcp-framework.vercel.app/oauth/token` |
| Scopes | `mcp:tools` |
| Token Auth Method | **None (PKCE only)** |

4. Click **Save & Connect** → authorize on the consent page.

## Demo Bearer Token (for debugging)

```
Authorization: Bearer mcp-demo-secret-2026
```

## Built-in Tools

- `hello` – greeting with authenticated user
- `get_server_time` – server UTC time
- `echo` – echo test
- `whoami` – current auth info

## Local Development

```bash
npm install
npm run dev
# MCP at http://localhost:3000/api/mcp
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------| 
| `MCP_DEMO_TOKEN` | Static demo bearer token | `mcp-demo-secret-2026` |
| `OAUTH_SECRET` | HMAC secret for JWT codes/tokens | demo secret |
| `MCP_RESOURCE_URL` | Public base URL of this server | auto from Vercel |

## Project Structure

```
src/
├── app/
│   ├── api/[transport]/route.ts          # MCP endpoint
│   ├── oauth/authorize/route.ts          # One-click consent
│   ├── oauth/token/route.ts              # Token exchange
│   ├── oauth/register/route.ts           # Dynamic client registration
│   └── .well-known/
│       ├── oauth-authorization-server/   # RFC 8414
│       └── oauth-protected-resource/     # RFC 9728
└── lib/
    ├── auth.ts                           # Token verification
    └── oauth.ts                          # JWT code/token helpers
```

## License

MIT

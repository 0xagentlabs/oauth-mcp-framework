# Grok OAuth MCP Protocol Contract

## Table of contents

1. [Endpoints](#endpoints)
2. [Authentication challenge](#authentication-challenge)
3. [Protected Resource Metadata](#protected-resource-metadata)
4. [Authorization Server Metadata](#authorization-server-metadata)
5. [Restricted Grok registration](#restricted-grok-registration)
6. [Token lifecycle](#token-lifecycle)
7. [Storage contract](#storage-contract)
8. [Deployment variables](#deployment-variables)
9. [Verification commands](#verification-commands)
10. [Notion comparison](#notion-comparison)

## Endpoints

For an MCP resource at `https://mcp.example.com/api/mcp`:

| Purpose | Endpoint |
|---|---|
| MCP Streamable HTTP | `/api/mcp` |
| Protected Resource Metadata | `/.well-known/oauth-protected-resource/api/mcp` |
| Authorization Server Metadata | `/.well-known/oauth-authorization-server` |
| Dynamic Client Registration | `/oauth/register` |
| Browser authorization | `/oauth/authorize` |
| Token and refresh | `/oauth/token` |

Keeping the root `/.well-known/oauth-protected-resource` as a compatibility alias is acceptable.

## Authentication challenge

An MCP request without a valid Bearer Token must return:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer error="invalid_token", resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/api/mcp"
Content-Type: application/json
```

The `resource_metadata` URL must be absolute and public-facing behind proxies.

## Protected Resource Metadata

RFC 9728:

```json
{
  "resource": "https://mcp.example.com/api/mcp",
  "authorization_servers": ["https://mcp.example.com"],
  "scopes_supported": [
    "mcp:tools",
    "mcp:read",
    "mcp:write",
    "openid",
    "offline_access"
  ],
  "bearer_methods_supported": ["header"],
  "resource_name": "Dedicated MCP Tools"
}
```

Use RFC 9728, not RFC 9470, when naming this document.

## Authorization Server Metadata

RFC 8414 minimum for automatic Grok connection:

```json
{
  "issuer": "https://mcp.example.com",
  "authorization_endpoint": "https://mcp.example.com/oauth/authorize",
  "token_endpoint": "https://mcp.example.com/oauth/token",
  "registration_endpoint": "https://mcp.example.com/oauth/register",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "scopes_supported": [
    "mcp:tools",
    "mcp:read",
    "mcp:write",
    "openid",
    "offline_access"
  ]
}
```

Without `registration_endpoint`, Grok can discover authorization and token endpoints but may still show a Client ID/Client Secret form.

## Restricted Grok registration

Expected DCR request shape:

```json
{
  "client_name": "Grok",
  "redirect_uris": [
    "https://grok.com/connectors-oauth-exchange-code/"
  ],
  "token_endpoint_auth_method": "none",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"]
}
```

Return:

```json
{
  "client_id": "grok",
  "client_id_issued_at": 1710000000,
  "client_name": "Grok",
  "redirect_uris": [
    "https://grok.com/connectors-oauth-exchange-code/"
  ],
  "token_endpoint_auth_method": "none",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"]
}
```

Requirements:

- Require exactly the official Grok callback including the trailing slash.
- Reject arbitrary redirect URIs.
- Do not issue or require a Client Secret for this public PKCE client.
- Do not persist registrations when the only valid result is the fixed Grok client.

## Token lifecycle

Authorization code:

- signed and issuer-bound;
- contains Client ID, redirect URI, PKCE challenge, scope, and JTI;
- expires in about five minutes;
- JTI stored with matching TTL;
- atomically consumed only after all binding and PKCE checks pass.

Access Token:

- signed with issuer and MCP-resource audience;
- `typ: access_token`;
- contains Client ID, subject, and scopes;
- short lifetime, such as one hour.

Refresh Token:

- signed with issuer and MCP-resource audience;
- `typ: refresh_token`;
- contains Client ID, subject, scopes, and JTI;
- durable JTI stored with its lifetime, such as 30 days;
- atomically consumed and replaced on every refresh;
- replay returns `invalid_grant`.

## Storage contract

Use durable Redis-compatible REST storage for:

```text
SET oauth:code:{jti} 1 EX 300 NX
GETDEL oauth:code:{jti}
SET oauth:refresh:{jti} 1 EX 2592000 NX
GETDEL oauth:refresh:{jti}
INCR oauth:authorize-limit:{identity}
EXPIRE oauth:authorize-limit:{identity} 600
```

Do not use serverless process memory for one-time state.

## Deployment variables

Public mode:

```dotenv
OAUTH_SECRET=at-least-32-random-characters
```

Configure one complete Redis pair:

```dotenv
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

or:

```dotenv
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Optional origin override:

```dotenv
MCP_RESOURCE_URL=https://mcp.example.com
```

Do not add `OAUTH_AUTHORIZATION_PASSWORD` in public mode.

## Verification commands

Challenge:

```bash
curl -i https://mcp.example.com/api/mcp
```

Metadata:

```bash
curl -fsS https://mcp.example.com/.well-known/oauth-protected-resource/api/mcp
curl -fsS https://mcp.example.com/.well-known/oauth-authorization-server
```

DCR:

```bash
curl -fsS -X POST \
  -H 'Content-Type: application/json' \
  --data '{"client_name":"Grok","redirect_uris":["https://grok.com/connectors-oauth-exchange-code/"],"token_endpoint_auth_method":"none","grant_types":["authorization_code","refresh_token"],"response_types":["code"]}' \
  https://mcp.example.com/oauth/register
```

Also send an attacker callback and require a 400 error.

## Notion comparison

Notion MCP demonstrates the relevant discovery chain:

- unauthenticated MCP returns a path-aware RFC 9728 URL;
- authorization metadata publishes a registration endpoint;
- the client can obtain credentials without a manual form;
- authorization code, PKCE, and Refresh Token grants are advertised.

Copy the standards behavior, not Notion-specific endpoints, scopes, authentication UI, or proprietary identity system.

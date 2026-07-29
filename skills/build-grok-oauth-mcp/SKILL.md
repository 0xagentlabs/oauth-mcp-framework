---
name: build-grok-oauth-mcp
description: Build, adapt, debug, and validate dedicated Streamable HTTP MCP tool servers that Grok can connect to by pasting one server URL and completing browser OAuth. Use for Grok Custom Connector MCP projects requiring OAuth discovery, restricted Dynamic Client Registration, Authorization Code with S256 PKCE, rotating refresh tokens, Vercel/Redis deployment, or Notion-like automatic connection behavior.
---

# Build Grok OAuth MCP

Build the smallest production implementation that gives Grok this flow:

```text
paste MCP URL → OAuth discovery → automatic client registration
→ browser confirmation → PKCE token exchange → tool use → token refresh
```

Read [references/protocol-contract.md](references/protocol-contract.md) before changing OAuth routes, metadata, tokens, or deployment configuration.

## Workflow

1. Inspect the existing repository end to end.
   - Find the MCP route, auth wrapper, OAuth routes, metadata routes, storage helper, tests, and deployment target.
   - Reuse the installed MCP/OAuth libraries and current routing conventions.
   - Do not scaffold a new server when the repository already has one.

2. Choose the access model explicitly.
   - For public Grok tools, use browser confirmation without a shared password.
   - State that every Grok user can call all exposed tools.
   - For private data, tenant isolation, or sensitive writes, stop and require a real IdP/session. Do not print, embed, or weaken a shared password.

3. Implement the automatic discovery chain.
   - Serve Streamable HTTP MCP over public HTTPS.
   - Return `401` with `WWW-Authenticate` containing an absolute `resource_metadata` URL.
   - Serve RFC 9728 metadata at the path-aware URL for the MCP resource.
   - Serve RFC 8414 authorization-server metadata with authorization, token, and registration endpoints.
   - Add restricted DCR so Grok receives a Client ID without a credential form.

4. Keep Grok registration narrow.
   - Accept only `https://grok.com/connectors-oauth-exchange-code/`.
   - Return a public client using `token_endpoint_auth_method: none`.
   - Support only `authorization_code`, `refresh_token`, and response type `code`.
   - Reject unknown redirect URIs and incompatible client metadata.
   - Prefer an idempotent fixed Grok Client ID over a client database when Grok is the only client.

5. Implement the OAuth boundary.
   - Require Authorization Code and S256 PKCE.
   - Validate Client ID, exact redirect URI, scope, issuer, audience, and token `typ`.
   - Store authorization-code JTIs in durable Redis-compatible storage and consume them atomically.
   - Issue short Access Tokens and rotating Refresh Tokens.
   - Store Refresh Token JTIs and reject replay with atomic consumption.
   - Never use process memory for one-time tokens on serverless deployments.

6. Add dedicated MCP tools.
   - Validate every input with the repository's schema library.
   - Bind private resource access to authenticated identity when an IdP exists.
   - Treat the current public-confirmation model as anonymous public access.
   - Escape public HTML output and bound stored content.
   - Add one focused runnable test for each non-trivial security or parsing branch.

7. Configure deployment minimally.
   - Infer the public origin from Vercel when available.
   - Require only a strong OAuth signing secret as a manual secret for public mode.
   - Support both Vercel KV (`KV_REST_API_*`) and native Upstash (`UPSTASH_REDIS_REST_*`) variable names.
   - Fail production startup/build with a clear error when neither complete Redis pair exists.
   - Inspect the actual deployment environment variable names; documentation is not proof that storage is connected.
   - Keep custom resource URL configuration optional for custom domains or non-Vercel hosts.

8. Verify in protocol order.
   - Run unit tests, type checking, production build, and dependency audit.
   - Start the production build locally when possible.
   - Verify the unauthenticated MCP challenge.
   - Fetch both metadata documents.
   - POST a realistic Grok DCR payload and confirm the returned Client ID.
   - Exercise authorization-code exchange, Refresh Token rotation, and replay rejection.
   - Test the deployed Grok authorization URL after deployment.
   - Complete browser confirmation and verify that authorization-code storage succeeds in the deployed environment.

## Required Proof

Do not call the work complete until evidence shows:

- unauthenticated MCP returns `401`, not an HTML login page;
- `WWW-Authenticate` names the path-aware RFC 9728 URL;
- authorization metadata publishes `registration_endpoint`;
- DCR accepts the official Grok callback and rejects an attacker callback;
- browser authorization uses S256 PKCE;
- authorization codes and Refresh Tokens reject replay;
- a production build succeeds without a callback or authorization-password environment variable;
- a production build fails clearly when Redis storage variables are absent;
- the deployed environment contains one complete Redis variable pair;
- Grok no longer asks the user to type Client ID or Client Secret.

If the last check still shows a credential form, compare live metadata with Notion MCP and confirm that the deployment—not only the local checkout—contains the registration endpoint. Delete and recreate the Grok Connector after deployment to clear cached configuration.

## Boundaries

- DCR is not authentication. Client IDs are public.
- Browser confirmation without login makes every tool public to Grok users.
- `offline_access` is meaningful only when Refresh Token issuance and rotation exist.
- A tunnel provides HTTPS reachability only; it does not implement OAuth.
- Do not add universal DCR, arbitrary redirects, password disclosure, static bearer tokens, or `demo-*` bypasses.
- Do not build user accounts, revocation services, or an IdP unless the requested tools require private authorization.

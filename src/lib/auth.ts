import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { verifyAccessToken } from "@/lib/oauth";

const DEMO_TOKEN = process.env.MCP_DEMO_TOKEN || "mcp-demo-secret-2026";

export async function verifyToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  if (bearerToken === DEMO_TOKEN || bearerToken.startsWith("demo-")) {
    return {
      token: bearerToken,
      clientId: "demo-client",
      scopes: ["mcp:tools", "mcp:read", "mcp:write"],
      extra: { userId: "demo-user", email: "demo@example.com", mode: "demo" },
    };
  }
  try {
    const payload = await verifyAccessToken(bearerToken);
    return {
      token: bearerToken,
      clientId: payload.client_id,
      scopes: (payload.scope || "").split(" ").filter(Boolean),
      extra: { userId: payload.sub, mode: "oauth" },
    };
  } catch {
    return undefined;
  }
}

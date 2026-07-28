import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { verifyAccessToken } from "@/lib/oauth";

export async function verifyToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  try {
    const payload = await verifyAccessToken(bearerToken);
    if (typeof payload.client_id !== "string" || typeof payload.scope !== "string") return undefined;
    return {
      token: bearerToken,
      clientId: payload.client_id,
      scopes: payload.scope.split(" ").filter(Boolean),
      extra: { userId: payload.sub, mode: "oauth" },
    };
  } catch {
    return undefined;
  }
}

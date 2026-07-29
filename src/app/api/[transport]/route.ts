import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { verifyToken } from "@/lib/auth";

const handler = createMcpHandler(
  (server) => {
    server.tool("hello", "Returns a greeting.", { name: z.string().min(1).max(100) }, async ({ name }) => ({
      content: [{ type: "text", text: `Hello, ${name}!` }],
    }));
  },
  {},
  { basePath: "/api", maxDuration: 60 }
);

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["mcp:tools"],
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };

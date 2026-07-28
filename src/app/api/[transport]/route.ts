import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { verifyToken } from "@/lib/auth";
import { publishPage } from "@/lib/pages";

const handler = createMcpHandler(
  (server) => {
    server.tool("hello", "A simple greeting tool.", { name: z.string().describe("Name") }, async ({ name }, { authInfo }) => {
      const user = (authInfo?.extra as any)?.userId ?? "anonymous";
      const mode = (authInfo?.extra as any)?.mode ?? "unknown";
      return { content: [{ type: "text", text: `Hello, ${name}! Authenticated as ${user} (mode: ${mode})` }] };
    });
    server.tool("get_server_time", "Returns server UTC time.", {}, async () => ({
      content: [{ type: "text", text: new Date().toISOString() }],
    }));
    server.tool("echo", "Echoes a message.", { message: z.string() }, async ({ message }) => ({
      content: [{ type: "text", text: `Echo: ${message}` }],
    }));
    server.tool("whoami", "Returns auth info.", {}, async (_a, { authInfo }) => {
      if (!authInfo) return { content: [{ type: "text", text: "Not authenticated" }] };
      return { content: [{ type: "text", text: JSON.stringify({ clientId: authInfo.clientId, scopes: authInfo.scopes, extra: authInfo.extra }, null, 2) }] };
    });
    server.tool(
      "publish_page",
      "Publishes a permanent public text page and returns its URL.",
      {
        title: z.string().trim().min(1).max(200),
        content: z.string().min(1).max(100_000),
      },
      async ({ title, content }) => {
        const page = await publishPage(title, content);
        return { content: [{ type: "text", text: JSON.stringify(page) }] };
      },
    );
  },
  {},
  { basePath: "/api", maxDuration: 60 }
);

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["mcp:tools"],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };

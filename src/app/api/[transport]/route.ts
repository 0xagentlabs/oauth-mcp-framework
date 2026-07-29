import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { verifyToken } from "@/lib/auth";
import { publishPage } from "@/lib/pages";

const handler = createMcpHandler(
  (server) => {
    server.tool("hello", "Returns a greeting.", { name: z.string().min(1).max(100) }, async ({ name }) => ({
      content: [{ type: "text", text: `Hello, ${name}!` }],
    }));
    server.tool(
      "publish_page",
      "Publishes a permanent public page from Markdown and returns its URL.",
      {
        title: z.string().trim().min(1).max(200),
        content: z.string().min(1).max(100_000).describe("Markdown content"),
      },
      async ({ title, content }) => ({
        content: [{ type: "text", text: JSON.stringify(await publishPage(title, content)) }],
      }),
    );
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

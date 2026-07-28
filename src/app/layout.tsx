import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "OAuth MCP Framework",
  description: "Secure MCP Server with OAuth 2.1 for Grok",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}

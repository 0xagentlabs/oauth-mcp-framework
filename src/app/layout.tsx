import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OAuth MCP Framework",
  description: "Secure MCP Server with OAuth 2.1 for Grok",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

import MarkdownIt from "markdown-it";
import { createBlob, readBlob } from "./blob-store.ts";
import { ISSUER } from "./oauth.ts";

export type PublicPage = { title: string; content: string; createdAt: string };

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

export async function publishPage(title: string, content: string) {
  const id = crypto.randomUUID();
  const page: PublicPage = { title, content, createdAt: new Date().toISOString() };
  await createBlob(`pages/${id}.json`, JSON.stringify(page));
  return { id, url: `${ISSUER}/p/${id}` };
}

export async function getPage(id: string): Promise<PublicPage | undefined> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return undefined;
  const value = await readBlob(`pages/${id}.json`);
  return value ? JSON.parse(value) as PublicPage : undefined;
}

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

export function renderPage(page: PublicPage) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(page.title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:3rem 1.5rem;line-height:1.7;color:#18181b}h1,h2,h3{line-height:1.25}a{color:#2563eb}pre{overflow:auto;padding:1rem;background:#f4f4f5;border-radius:.5rem}code{font-family:ui-monospace,monospace}blockquote{margin-left:0;padding-left:1rem;border-left:3px solid #d4d4d8;color:#52525b}img{max-width:100%}.content{overflow-wrap:anywhere}.meta{color:#71717a;font-size:.85rem;margin-top:3rem}</style></head>
<body><main><h1>${escapeHtml(page.title)}</h1><article class="content">${markdown.render(page.content)}</article><div class="meta">Published ${escapeHtml(page.createdAt)}</div></main></body></html>`;
}

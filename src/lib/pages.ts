import { ISSUER, redis } from "./oauth.ts";

export type PublicPage = { title: string; content: string; createdAt: string };

export async function publishPage(title: string, content: string) {
  const id = crypto.randomUUID();
  const page: PublicPage = { title, content, createdAt: new Date().toISOString() };
  await redis(["SET", `page:${id}`, JSON.stringify(page)]);
  return { id, url: `${ISSUER}/p/${id}` };
}

export async function getPage(id: string): Promise<PublicPage | undefined> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return undefined;
  const value = await redis(["GET", `page:${id}`]);
  return typeof value === "string" ? JSON.parse(value) as PublicPage : undefined;
}

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

export function renderPage(page: PublicPage) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(page.title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:3rem 1.5rem;line-height:1.7;color:#18181b}h1{line-height:1.2}.content{white-space:pre-wrap;overflow-wrap:anywhere}.meta{color:#71717a;font-size:.85rem;margin-top:3rem}</style></head>
<body><main><h1>${escapeHtml(page.title)}</h1><div class="content">${escapeHtml(page.content)}</div><div class="meta">Published ${escapeHtml(page.createdAt)}</div></main></body></html>`;
}

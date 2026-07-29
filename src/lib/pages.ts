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
<style>:root{color-scheme:light dark;--bg:#f5f7fb;--paper:#fff;--text:#1b2433;--muted:#707b8e;--line:#e1e6ee;--accent:#2563eb;--code:#f1f4f8}*{box-sizing:border-box}body{margin:0;padding:48px 20px;background:radial-gradient(circle at 15% 0,#dbeafe 0,transparent 28rem),var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,sans-serif;line-height:1.75}main{width:min(820px,100%);margin:auto;padding:clamp(28px,6vw,64px);border:1px solid var(--line);border-radius:24px;background:var(--paper);box-shadow:0 24px 70px #0f172a12}.label{margin:0 0 10px;color:var(--accent);font-size:12px;font-weight:750;letter-spacing:.12em;text-transform:uppercase}h1{margin:0 0 36px;font-size:clamp(32px,7vw,52px);letter-spacing:-.04em;line-height:1.1}h2,h3{margin-top:2em;line-height:1.3}a{color:var(--accent);text-underline-offset:3px}pre{overflow:auto;padding:18px;border:1px solid var(--line);border-radius:12px;background:var(--code)}code{padding:.15em .35em;border-radius:5px;background:var(--code);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em}pre code{padding:0;background:none}blockquote{margin:1.5em 0;padding:.25em 1.25em;border-left:3px solid var(--accent);color:var(--muted)}img{max-width:100%;border-radius:12px}.content{overflow-wrap:anywhere}.content li{margin:.3em 0}.content hr{margin:2.5em 0;border:0;border-top:1px solid var(--line)}.meta{margin-top:48px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}@media(max-width:560px){body{padding:12px}main{border-radius:16px}}@media(prefers-color-scheme:dark){:root{--bg:#090d14;--paper:#111827;--text:#edf2f7;--muted:#9ba7b9;--line:#283448;--accent:#60a5fa;--code:#1d2735}body{background:radial-gradient(circle at 15% 0,#172554 0,transparent 28rem),var(--bg)}}</style></head>
<body><main><div class="label">Published page</div><h1>${escapeHtml(page.title)}</h1><article class="content">${markdown.render(page.content)}</article><div class="meta">发布于 ${escapeHtml(page.createdAt)}</div></main></body></html>`;
}

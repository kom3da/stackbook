// A small HTML fragment per tool, loaded into the peek dialog (src/scripts/global.ts)
import type { APIRoute } from 'astro';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToolBody } from '../../../components/ToolBody';
import { category, dictionary, type Tool } from '../../../lib/tools';
import { LINKS, toolView } from '../../../lib/view';

export const getStaticPaths = () => dictionary().map((t) => ({ params: { slug: t.slug }, props: { t } }));

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export const GET: APIRoute = ({ props }) => {
  const t = (props as { t: Tool }).t;
  const body = renderToStaticMarkup(createElement(ToolBody, { tool: toolView(t), links: LINKS }));
  const html = `<header class="peek-h"><p class="eyebrow">${esc(category(t))}</p><h2 id="peek-title">${esc(t.name)}</h2></header>
<div class="peek-b">${body}</div>
<p class="peek-more"><a class="ref" href="/dict/${t.slug}/">辞書のページで見る →</a></p>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};

// A small HTML fragment per tool, loaded into the peek dialog (src/scripts/global.ts)
import type { APIRoute } from 'astro';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToolBody } from '../../../components/ToolBody';
import { fragment } from '../../../lib/peek';
import { category, dictionary, type Tool } from '../../../lib/tools';
import { LINKS, toolView } from '../../../lib/view';

export const getStaticPaths = () => dictionary().map((t) => ({ params: { slug: t.slug }, props: { t } }));

export const GET: APIRoute = ({ props }) => {
  const t = (props as { t: Tool }).t;
  const body = renderToStaticMarkup(createElement(ToolBody, { tool: toolView(t), links: LINKS }));
  return new Response(fragment(`ツール・${category(t)}`, t.name, body, `/dict/${t.slug}/`, `/dict/${t.slug}.md`), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};

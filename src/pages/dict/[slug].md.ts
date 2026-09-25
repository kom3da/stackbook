import type { APIRoute } from 'astro';
import { toolMd } from '../../lib/md';
import { dictionary, type Tool } from '../../lib/tools';

export const getStaticPaths = () => dictionary().map((t) => ({ params: { slug: t.slug }, props: { t } }));
export const GET: APIRoute = ({ props }) =>
  new Response(toolMd((props as { t: Tool }).t), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });

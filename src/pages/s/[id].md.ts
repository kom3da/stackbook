import type { APIRoute } from 'astro';
import { guide, rawSection } from '../../lib/guide';
import { toMarkdown } from '../../lib/md';

export const getStaticPaths = () => guide.sections.map((s) => ({ params: { id: s.id } }));
export const GET: APIRoute = ({ params }) =>
  new Response(`${toMarkdown(rawSection(params.id as string))}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });

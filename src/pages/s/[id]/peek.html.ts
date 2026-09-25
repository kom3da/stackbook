import type { APIRoute } from 'astro';
import { guide, type Section } from '../../../lib/guide';
import { sectionPeek } from '../../../lib/peek';

export const getStaticPaths = () => guide.sections.map((s) => ({ params: { id: s.id }, props: { s } }));
export const GET: APIRoute = ({ props }) =>
  new Response(sectionPeek((props as { s: Section }).s), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

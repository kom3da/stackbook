import type { APIRoute } from 'astro';
import type { Section } from '../../../../lib/guide';
import { subsectionPeek, subsections } from '../../../../lib/peek';

export const getStaticPaths = () =>
  subsections().map(({ s, id, text }) => ({ params: { id: s.id, sub: id }, props: { s, id, text } }));
export const GET: APIRoute = ({ props }) => {
  const { s, id, text } = props as { s: Section; id: string; text: string };
  return new Response(subsectionPeek(s, id, text), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};

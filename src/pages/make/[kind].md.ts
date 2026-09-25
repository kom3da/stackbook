import type { APIRoute } from 'astro';
import { makeMd } from '../../lib/md';
import { KINDS, type Kind } from '../../lib/wizard';

export const getStaticPaths = () => KINDS.map(([kind]) => ({ params: { kind } }));
export const GET: APIRoute = ({ params }) =>
  new Response(makeMd(params.kind as Kind), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });

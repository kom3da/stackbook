import { rawGuide } from '../lib/guide';

export const GET = () => new Response(rawGuide, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });

import { rawGuide } from '../lib/guide';
import { toMarkdown } from '../lib/md';

export const GET = () =>
  new Response(`${toMarkdown(rawGuide)}\n`, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });

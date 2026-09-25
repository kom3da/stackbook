import { dictMd } from '../lib/md';

export const GET = () => new Response(dictMd(), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });

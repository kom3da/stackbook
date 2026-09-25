// Tool icons from Simple Icons (CC0), resolved at build time. Only a tool's own mark or its product family's
// mark is used — never a language's mark for a library written in it, which would misrepresent the tool.
import * as si from 'simple-icons';
import { TOOLS } from './tools';

type Icon = { title: string; path: string };
const all = Object.values(si).filter((x): x is si.SimpleIcon => typeof x === 'object' && !!x && 'slug' in x);
const bySlug = new Map(all.map((i) => [i.slug, i]));
const byTitle = new Map(all.map((i) => [i.title.toLowerCase(), i]));

/** Tools whose mark is their product family's (tool id → Simple Icons slug) */
const FAMILY: Record<string, string> = {
  rails: 'rubyonrails',
  'react-native': 'react',
  'tanstack-query': 'reactquery',
  'tanstack-router': 'tanstack',
  'tanstack-table': 'tanstack',
  phoenix: 'phoenixframework',
  'phoenix-channels': 'phoenixframework',
  'phoenix-liveview': 'phoenixframework',
  'phoenix-presence': 'phoenixframework',
  fcm: 'firebase',
  ga4: 'googleanalytics',
  'grafana-cloud': 'grafana',
  junit: 'junit5',
  'expo-notifications': 'expo',
  'expo-router': 'expo',
  'eas-build': 'expo',
  'eas-submit': 'expo',
  'eas-update': 'expo',
  'cloudflare-durable-objects': 'cloudflare',
  'cloudflare-images': 'cloudflare',
  'cloudflare-stream': 'cloudflare',
  'cloudflare-turnstile': 'cloudflare',
  'cloudflare-waiting-room': 'cloudflare',
  'cloudflare-web-analytics': 'cloudflare',
  'shopify-functions': 'shopify',
  'shopify-payments': 'shopify',
  liquid: 'shopify',
  'spring-batch': 'spring',
  'spring-for-apache-kafka': 'spring',
  'springdoc-openapi': 'spring',
  'pnpm-workspaces': 'pnpm',
  openapi: 'openapiinitiative',
  'hono-zod-openapi': 'hono',
  'tailwindcss-rails': 'tailwindcss',
  'github-releases': 'github',
  payload: 'payloadcms',
  bigquery: 'googlebigquery',
};

const cache = new Map<string, Icon | undefined>();
export function iconOf(id: string): Icon | undefined {
  if (cache.has(id)) return cache.get(id);
  const t = TOOLS.get(id);
  const hit =
    (FAMILY[id] && bySlug.get(FAMILY[id])) ??
    (t && byTitle.get(t.name.toLowerCase())) ??
    bySlug.get(id.replace(/-/g, '')) ??
    bySlug.get(id);
  const icon = hit ? { title: hit.title, path: hit.path } : undefined;
  cache.set(id, icon);
  return icon;
}

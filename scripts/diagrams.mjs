// Renders every ```mermaid block in content/guide/*.md to src/diagrams/<hash>.svg with a local Chrome.
// The SVGs are committed, so neither the build nor CI needs a browser. Run: pnpm diagrams
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import YAML from 'yaml';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'src/diagrams');
const chrome =
  process.env.CHROME_PATH ??
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(
    existsSync,
  );
if (!chrome) throw new Error('Chrome not found; set CHROME_PATH');

/** Same hash as src/lib/guide.ts uses to find the SVG */
export const hashOf = (code) => createHash('sha256').update(code).digest('hex').slice(0, 12);

// Mermaid sources, skipping anything inside other fences
const sources = new Map();
for (const f of readdirSync(join(root, 'content/guide')).sort()) {
  const lines = readFileSync(join(root, 'content/guide', f), 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('```')) continue;
    const kind = lines[i].slice(3).trim();
    const body = [];
    for (i++; i < lines.length && !lines[i].startsWith('```'); i++) body.push(lines[i]);
    if (kind === 'mermaid') sources.set(hashOf(body.join('\n')), body.join('\n'));
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'stackbook-diagrams-'));
const config = join(tmp, 'config.json');
const puppeteer = join(tmp, 'puppeteer.json');
writeFileSync(
  config,
  JSON.stringify({
    theme: 'base',
    securityLevel: 'strict',
    themeVariables: {
      background: 'transparent',
      fontFamily: '"Hiragino Sans","Noto Sans JP","IBM Plex Sans JP",sans-serif',
      fontSize: '14px',
      primaryColor: '#E6EEF6',
      primaryBorderColor: '#1F4E79',
      primaryTextColor: '#1B232B',
      lineColor: '#5B6770',
      secondaryColor: '#F7F7F4',
      tertiaryColor: '#FFFFFF',
      edgeLabelBackground: '#FFFFFF',
    },
    flowchart: { htmlLabels: false, padding: 16, nodeSpacing: 36, rankSpacing: 44, useMaxWidth: true, curve: 'basis' },
    // Flat, rounded nodes and softer edges to match the site
    themeCSS: [
      '.node rect, .node polygon, .node path, .node circle { filter: none !important; stroke-width: 1.5px; }',
      '.node rect { rx: 8px; ry: 8px; }',
      '.flowchart-link { stroke: #86919a !important; stroke-width: 1.5px !important; }',
      '.marker { fill: #86919a !important; stroke: #86919a !important; }',
      '.edgeLabel rect { fill: #f7f7f4 !important; }',
      '.edgeLabel text, .edgeLabel tspan { fill: #5b6770 !important; font-size: 12px; }',
      '.node .label text, .node .label tspan { font-weight: 500; }',
    ].join(' '),
  }),
);
writeFileSync(puppeteer, JSON.stringify({ executablePath: chrome, args: ['--no-sandbox'] }));
mkdirSync(out, { recursive: true });

// Colour each node by who runs the tool its label names (content/tools.yaml `ops`), like the answer bands
const registry = YAML.parse(readFileSync(join(root, 'content/tools.yaml'), 'utf8'));
const TOOLS = Object.values(registry)
  .map((v) => (typeof v === 'string' ? { name: v } : v))
  .filter((t) => t.ops || t.lang)
  .sort((a, b) => b.name.length - a.name.length);
const ACTORS = /ユーザー|社員|購入者|利用企業|クライアント|編集者|大量アクセス/;
const CLASSES = [
  'classDef code fill:#1f4e79,stroke:#1f4e79,color:#ffffff',
  'classDef self fill:#3d6b99,stroke:#3d6b99,color:#ffffff',
  'classDef managed fill:#dce8f3,stroke:#b9cfe4,color:#1b232b',
  'classDef actor fill:#ffffff,stroke:#86919a,color:#1b232b',
];
function styled(code) {
  const assigned = new Map();
  // Node definitions such as A["label"], DB[("label")], X{"label"}
  for (const m of code.matchAll(/\b([A-Za-z][\w]*)\s*[[({]+"([^"]+)"/g)) {
    const [, id, label] = m;
    if (assigned.has(id)) continue;
    const text = label.replace(/<br\/?>/g, ' ');
    if (ACTORS.test(text)) {
      assigned.set(id, 'actor');
      continue;
    }
    // With several tools in one label, the most managed one wins (e.g. "PostgreSQL / RDS" is managed)
    const found = TOOLS.filter((t) =>
      new RegExp(`(^|[^A-Za-z0-9])${t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z0-9])`, 'i').test(text),
    ).map((t) => t.ops ?? 'code');
    const cls = ['managed', 'self', 'code'].find((c) => found.includes(c));
    if (cls) assigned.set(id, cls);
  }
  const lines = [...assigned].map(([id, cls]) => `  class ${id} ${cls}`);
  return [code, ...CLASSES.map((c) => `  ${c}`), ...lines].join('\n');
}

const force = process.argv.includes('--force');
const mmdc = join(root, 'node_modules/.bin/mmdc');
let made = 0;
for (const [hash, code] of sources) {
  const svg = join(out, `${hash}.svg`);
  if (existsSync(svg) && !force) continue;
  const input = join(tmp, `${hash}.mmd`);
  writeFileSync(input, styled(code));
  // A unique svg id keeps each diagram's scoped styles from clashing on one page
  execFileSync(mmdc, ['-i', input, '-o', svg, '-c', config, '-p', puppeteer, '-b', 'transparent', '-I', `mm-${hash}`], {
    stdio: 'inherit',
  });
  made++;
}
// Remove SVGs no longer referenced by the guide
let removed = 0;
for (const f of readdirSync(out))
  if (f.endsWith('.svg') && !sources.has(f.slice(0, -4))) {
    rmSync(join(out, f));
    removed++;
  }
rmSync(tmp, { recursive: true, force: true });
console.log(`diagrams: ${sources.size} total, ${made} rendered, ${removed} removed`);

// Renders every ```mermaid block in content/guide/*.md to src/diagrams/<hash>.svg with a local Chrome.
// Text is measured in the site's typeface and colours become the site's CSS variables, so the SVGs look native.
// The SVGs are committed, so neither the build nor CI needs a browser. Run: pnpm diagrams (--force re-renders all)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
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

const FONT = '"IBM Plex Sans JP","Hiragino Sans",sans-serif';
const CONFIG = {
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'strict',
  themeVariables: {
    background: 'transparent',
    fontFamily: FONT,
    fontSize: '14px',
    // Nodes without an operations class stay neutral
    primaryColor: '#EFECE5',
    primaryBorderColor: '#E4E0D6',
    primaryTextColor: '#1D1B18',
    lineColor: '#6B655A',
    secondaryColor: '#F7F5F0',
    tertiaryColor: '#FFFFFF',
    edgeLabelBackground: '#FFFFFF',
  },
  flowchart: { htmlLabels: false, padding: 16, nodeSpacing: 36, rankSpacing: 44, useMaxWidth: true, curve: 'basis' },
  // Flat, rounded nodes and softer edges to match the site
  themeCSS: [
    '.node rect, .node polygon, .node path, .node circle { filter: none !important; stroke-width: 1.5px; }',
    '.node rect { rx: 8px; ry: 8px; }',
    '.flowchart-link { stroke: #6b655a !important; stroke-width: 1.5px !important; }',
    '.marker { fill: #6b655a !important; stroke: #6b655a !important; }',
    '.edgeLabel rect { fill: #f7f5f0 !important; opacity: 1 !important; }',
    '.edgeLabel text, .edgeLabel tspan { fill: #4a453d !important; font-size: 12px; }',
    '.node .label text, .node .label tspan { font-weight: 500; }',
  ].join(' '),
};
mkdirSync(out, { recursive: true });

// Shape each node by who runs the tool its label names (content/tools.yaml `ops`), like the marks on the make page:
// filled = you write it, solid outline = you run it, dashed outline = managed
const registry = YAML.parse(readFileSync(join(root, 'content/tools.yaml'), 'utf8'));
const TOOLS = Object.values(registry)
  .map((v) => (typeof v === 'string' ? { name: v } : v))
  .filter((t) => t.ops || t.lang)
  .sort((a, b) => b.name.length - a.name.length);
const ACTORS = /ユーザー|社員|購入者|利用企業|クライアント|編集者|大量アクセス/;
const CLASSES = [
  'classDef code fill:#1d1b18,stroke:#1d1b18,color:#ffffff',
  'classDef self fill:#ffffff,stroke:#1d1b18,stroke-width:2px,color:#1d1b18',
  'classDef managed fill:#ffffff,stroke:#1d1b18,stroke-width:1.5px,stroke-dasharray:5 4,color:#1d1b18',
  // People and traffic are plain labels, so they don't read as a component
  'classDef actor fill:transparent,stroke:transparent,color:#1d1b18,font-weight:600',
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

// Site colours as CSS variables (defined in src/styles/global.css); only style values accept var()
const VARS = {
  '#1d1b18': 'var(--ink)',
  '#4a453d': 'var(--mute)',
  '#6b655a': 'var(--faint)',
  '#f7f5f0': 'var(--bg)',
  '#efece5': 'var(--sunk)',
  '#e4e0d6': 'var(--rule)',
};
const themed = (svg) =>
  svg.replace(/(style="[^"]*"|<style>[\s\S]*?<\/style>)/g, (m) =>
    m.replace(/#[0-9a-fA-F]{6}\b/g, (hex) => VARS[hex.toLowerCase()] ?? hex),
  );

const force = process.argv.includes('--force');
const todo = [...sources].filter(([hash]) => force || !existsSync(join(out, `${hash}.svg`)));
if (todo.length) {
  const browser = await puppeteer.launch({ executablePath: chrome, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(
    '<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@400;500;600&display=block"></head><body><div id="c"></div></body></html>',
    { waitUntil: 'networkidle0' },
  );
  await page.addScriptTag({ path: join(root, 'node_modules/mermaid/dist/mermaid.min.js') });
  for (const [hash, code] of todo) {
    const svg = await page.evaluate(
      async ({ id, code, config, font }) => {
        // Load the font subsets this diagram's text needs before Mermaid measures it
        await Promise.all(['400', '500', '600'].map((w) => document.fonts.load(`${w} 14px ${font}`, code)));
        window.mermaid.initialize(config);
        return (await window.mermaid.render(id, code, document.getElementById('c'))).svg;
      },
      { id: `mm-${hash}`, code: styled(code), config: CONFIG, font: '"IBM Plex Sans JP"' },
    );
    writeFileSync(join(out, `${hash}.svg`), themed(svg));
  }
  await browser.close();
}
const made = todo.length;
// Remove SVGs no longer referenced by the guide
let removed = 0;
for (const f of readdirSync(out))
  if (f.endsWith('.svg') && !sources.has(f.slice(0, -4))) {
    rmSync(join(out, f));
    removed++;
  }
console.log(`diagrams: ${sources.size} total, ${made} rendered, ${removed} removed`);

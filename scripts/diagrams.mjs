// Renders every ```mermaid block in content/guide/*.md to src/diagrams/<hash>.svg with a local Chrome.
// The SVGs are committed, so neither the build nor CI needs a browser. Run: pnpm diagrams
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
    flowchart: { htmlLabels: false, padding: 14, nodeSpacing: 28, rankSpacing: 36, useMaxWidth: true },
  }),
);
writeFileSync(puppeteer, JSON.stringify({ executablePath: chrome, args: ['--no-sandbox'] }));
mkdirSync(out, { recursive: true });

const mmdc = join(root, 'node_modules/.bin/mmdc');
let made = 0;
for (const [hash, code] of sources) {
  const svg = join(out, `${hash}.svg`);
  if (existsSync(svg)) continue;
  const input = join(tmp, `${hash}.mmd`);
  writeFileSync(input, code);
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

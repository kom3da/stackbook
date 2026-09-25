// Screenshots of the built site for visual review: each page at phone, tablet and desktop widths,
// plus the phone interactions (index sheet, reference pane, compare, search). Phones use WebKit, as on an iPhone.
// Images are viewport tiles (under 2000px a side) in .shots/<width>/ (or $SHOTS_DIR). Run: pnpm build && pnpm shots [name filter]
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium, webkit } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const out = process.env.SHOTS_DIR ?? join(root, '.shots');
const port = 4329;
const base = `http://localhost:${port}`;
const filter = process.argv[2] ?? '';
if (!existsSync(join(root, 'dist/index.html'))) throw new Error('No build; run pnpm build first');

const PAGES = [
  ['home', '/'],
  ['make-web', '/make/web/'],
  ['make-rt', '/make/rt/'],
  ['dict', '/dict/'],
  ['dict-hono', '/dict/hono/'],
  ['s2', '/s/2/'],
  ['s19', '/s/19/'],
  ['s22', '/s/22/'],
  ['s26', '/s/26/'],
  ['s27', '/s/27/'],
  ['read', '/read/'],
  ['kit', '/kit/'],
  ['404', '/404.html'],
];
const WIDTHS = [
  { w: 360, h: 740, phone: true },
  { w: 390, h: 844, phone: true },
  { w: 768, h: 1024 },
  { w: 1280, h: 800 },
];
// Phone interactions: [name, page, action]
const ACTIONS = [
  ['sheet-index', '/s/2/', (p) => p.locator('[data-sheet-open]:visible').first().click()],
  ['sheet-kind', '/make/web/', (p) => p.locator('.kind-pick').click()],
  ['peek-tool', '/make/web/', (p) => p.locator('.memo a.tl:visible').first().click()],
  ['peek-sec', '/s/22/', (p) => p.locator('.paper a.ref:visible').first().click()],
  ['compare', '/make/rt/', (p) => p.getByRole('button', { name: '条件を並べて比べる' }).click(), '#cmp'],
  [
    'search',
    '/',
    async (p) => {
      await p.locator('#q').click();
      await p.locator('#q').fill('post');
    },
  ],
];
const MAX_TILES = 10;

// A plain static server for dist/ (astro preview runs as a shared background daemon)
const TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};
const dist = join(root, 'dist');
const server = createServer((req, res) => {
  let f = join(dist, normalize(decodeURIComponent(new URL(req.url, base).pathname)));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  const found = f.startsWith(dist) && existsSync(f);
  res.writeHead(found ? 200 : 404, {
    'content-type': TYPES[extname(found ? f : '.html')] ?? 'application/octet-stream',
  });
  res.end(readFileSync(found ? f : join(dist, '404.html')));
});
await new Promise((r) => server.listen(port, r));

/** Screenshots of the page as the eye scrolls through it, one viewport each */
async function tiles(page, dir, name) {
  const full = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = page.viewportSize().height;
  const n = Math.min(MAX_TILES, Math.ceil(full / vh));
  for (let i = 0; i < n; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * vh);
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(dir, `${name}-${String(i + 1).padStart(2, '0')}.png`) });
  }
}

const browsers = { webkit: await webkit.launch(), chromium: await chromium.launch() };
// A filtered run only replaces its own shots
if (!filter) rmSync(out, { recursive: true, force: true });
try {
  // Each width in its own context, all at once
  await Promise.all(
    WIDTHS.map(async (v) => {
      const dir = join(out, String(v.w));
      mkdirSync(dir, { recursive: true });
      const ctx = await browsers[v.phone ? 'webkit' : 'chromium'].newContext({
        viewport: { width: v.w, height: v.h },
        // Sharp, but every side under 2000px so the images can be read back by review tools
        deviceScaleFactor: Math.min(2, 1990 / Math.max(v.w, v.h)),
        isMobile: v.phone,
        hasTouch: v.phone,
      });
      const page = await ctx.newPage();
      for (const [name, path] of PAGES) {
        if (!name.includes(filter)) continue;
        await page.goto(base + path, { waitUntil: 'networkidle' });
        await tiles(page, dir, name);
      }
      for (const [name, path, act, target] of v.phone ? ACTIONS : []) {
        if (!name.includes(filter)) continue;
        await page.goto(base + path, { waitUntil: 'networkidle' });
        try {
          await act(page);
          await page.waitForTimeout(500);
          if (target) await page.locator(target).evaluate((el) => el.scrollIntoView({ block: 'start' }));
          await page.screenshot({ path: join(dir, `act-${name}.png`) });
        } catch (e) {
          console.error(`${v.w} ${name}: ${e.message.split('\n')[0]}`);
        }
      }
      await ctx.close();
    }),
  );
} finally {
  await Promise.all(Object.values(browsers).map((b) => b.close()));
  server.close();
}
console.log(`Screenshots in ${out}`);

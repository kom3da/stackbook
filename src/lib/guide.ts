import { createHash } from 'node:crypto';
import YAML from 'yaml';
import toolsYaml from '../../content/tools.yaml?raw';
import { stepId } from './inline';
import { type Data, isDataKind, type Ops, parseData, TOOLS_FILE, toolIds } from './schema';
import { plain } from './text';

// Diagrams are rendered ahead of time (scripts/diagrams.mjs) and looked up by the hash of their source
const svgs = import.meta.glob<string>('../diagrams/*.svg', { query: '?raw', import: 'default', eager: true });
const SVG = new Map(Object.entries(svgs).map(([k, v]) => [k.replace(/^.*\/|\.svg$/g, ''), v]));
function diagram(code: string) {
  const hash = createHash('sha256').update(code).digest('hex').slice(0, 12);
  const svg = SVG.get(hash);
  if (!svg) throw new Error(`Diagram ${hash} is not rendered. Run: pnpm diagrams`);
  return svg;
}

// Sections live in content/guide/NN.md; files are read in name order and joined
const files = import.meta.glob<string>('../../content/guide/*.md', { query: '?raw', import: 'default', eager: true });
const md = Object.keys(files)
  .sort()
  .map((k) => files[k].trimEnd())
  .join('\n\n');

export { plain };

export type Block =
  | { t: 'h3'; id: string; text: string }
  | { t: 'h4'; text: string; id?: string }
  | { t: 'p'; text: string }
  | { t: 'ul' | 'ol' | 'check'; items: string[] }
  | { t: 'code'; text: string }
  /** svg: pre-rendered by `pnpm diagrams` (src/diagrams/<hash>.svg) */
  | { t: 'mermaid'; text: string; svg: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'data'; d: Data };

/** checked: when the section was last reviewed (the "確認：…" line under its heading) */
export type Section = { id: string; num: string; title: string; checked: string; blocks: Block[] };
export type Guide = { title: string; meta: string[]; sections: Section[] };

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|+|\|+$/g, '')
    .split('|')
    .map((c) => c.trim());

// Parses guide.md into structured data. Section ids: "2" for "## 2. …", "intro", "memo".
export function parseGuide(src: string, svgOf: (code: string) => string = diagram): Guide {
  const lines = src.split('\n');
  const sections: Section[] = [];
  let title = '';
  let meta: string[] = [];
  let cur: Section | undefined;
  let para: string[] = [];
  let i = 0;

  const push = (b: Block) => {
    if (!cur) throw new Error(`Content before the first section at line ${i + 1}`);
    cur.blocks.push(b);
  };
  const flush = () => {
    if (!para.length) return;
    push({ t: 'p', text: para.join(' ') });
    para = [];
  };
  const fence = () => {
    i++;
    const code: string[] = [];
    while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
    i++;
    return code.join('\n');
  };
  const collect = <T>(re: RegExp, strip: (l: string) => T) => {
    const items: T[] = [];
    while (i < lines.length && re.test(lines[i])) items.push(strip(lines[i++]));
    return items;
  };

  while (i < lines.length) {
    const L = lines[i];
    if (L.startsWith('# ')) {
      title = L.slice(2).trim();
      i++;
    } else if (L.startsWith('確認：') && cur && !cur.blocks.length && !para.length) {
      cur.checked = L.slice(3).trim();
      i++;
    } else if (L.startsWith('作成：')) {
      meta = L.split('／').map((p) => p.trim());
      i++;
    } else if (L.trim() === '---' || L.trim() === '') {
      flush();
      i++;
    } else if (L.startsWith('## ')) {
      flush();
      const h = L.slice(3).trim();
      const m = h.match(/^(\d+)\.\s*(.*)/);
      const id = m ? m[1] : h.includes('使い方') ? 'intro' : 'memo';
      cur = { id, num: m ? m[1] : '', title: m ? m[2] : h, checked: '', blocks: [] };
      sections.push(cur);
      i++;
    } else if (L.startsWith('#### ')) {
      flush();
      // "#### 手順K" under "### N-M." gets an anchor, so "§N-M 手順K" can point at it
      const text = L.slice(5).trim();
      const step = text.match(/^手順(\d+)/)?.[1];
      const h3 = cur?.blocks.findLast((b) => b.t === 'h3');
      push({ t: 'h4', text, id: step && h3?.t === 'h3' && /^\d+-\d+$/.test(h3.id) ? stepId(h3.id, step) : undefined });
      i++;
    } else if (L.startsWith('### ')) {
      flush();
      const h = L.slice(4).trim();
      const m = h.match(/^(\d+-\d+)\./);
      push({ t: 'h3', id: m ? m[1] : `h${cur?.blocks.length ?? 0}`, text: h });
      i++;
    } else if (L.startsWith('```')) {
      flush();
      const info = L.slice(3).trim();
      const at = `§${cur?.num || cur?.id} line ${i + 1}`;
      const text = fence();
      if (isDataKind(info)) {
        try {
          push({ t: 'data', d: parseData(info, YAML.parse(text)) });
        } catch (e) {
          throw new Error(`Invalid \`${info}\` block (${at}): ${(e as Error).message}`);
        }
      } else if (info === 'mermaid') push({ t: 'mermaid', text, svg: svgOf(text) });
      else push({ t: 'code', text });
    } else if (L.startsWith('|')) {
      flush();
      const [head, , ...rows] = collect(/^\|/, cells);
      push({ t: 'table', head, rows: rows.filter((r) => r.some((c) => c !== '')) });
    } else if (/^- \[ \] /.test(L)) {
      flush();
      push({ t: 'check', items: collect(/^- \[ \] /, (l) => l.slice(6)) });
    } else if (L.startsWith('- ')) {
      flush();
      push({ t: 'ul', items: collect(/^- /, (l) => l.slice(2)) });
    } else if (/^\d+\. /.test(L)) {
      flush();
      push({ t: 'ol', items: collect(/^\d+\. /, (l) => l.replace(/^\d+\. /, '')) });
    } else {
      para.push(L.trim());
      i++;
    }
  }
  flush();
  return { title, meta, sections };
}

export const guide = parseGuide(md);

// Tool registry (content/tools.yaml); every id used in a data block must be registered
export const REGISTRY = new Map(
  Object.entries(TOOLS_FILE.parse(YAML.parse(toolsYaml))).map(([id, v]) => [
    id,
    typeof v === 'string'
      ? {
          name: v,
          lang: undefined as string | undefined,
          url: undefined as string | undefined,
          ops: undefined as Ops | undefined,
        }
      : v,
  ]),
);
{
  const missing = new Set<string>();
  for (const s of guide.sections)
    for (const b of s.blocks)
      if (b.t === 'data') for (const id of toolIds(b.d)) if (!REGISTRY.has(id)) missing.add(`${id} (§${s.id})`);
  if (missing.size) throw new Error(`Unknown tool ids, add them to content/tools.yaml: ${[...missing].join(', ')}`);
}
export const SEC = new Map(guide.sections.map((s) => [s.id, s]));

// Sections the code refers to by role. Update here when the guide is renumbered.
export const SECS = {
  cases: '19',
  checklist: '21',
  why: '22',
  whyTools: '22-2',
  numbers: '23',
  growth: '24',
  cost: '25',
  commands: '26',
  commandsCommon: '26-1',
  prof: '27',
} as const;

export const GROUPS = {
  tools: Array.from({ length: 19 }, (_, i) => String(i + 1)),
  read: ['intro', '20', SECS.why, SECS.numbers, SECS.growth, SECS.cost],
  kit: [SECS.checklist, SECS.commands, SECS.prof, 'memo'],
} as const;
export type Group = keyof typeof GROUPS;
export const GROUP_LABEL: Record<Group, string> = { tools: '辞書（分野別）', read: '考え方', kit: '準備' };
export const groupOf = (id: string): Group =>
  (Object.keys(GROUPS) as Group[]).find((g) => (GROUPS[g] as readonly string[]).includes(id)) ?? 'read';

// Screen labels go without the section sign, which many readers don't know; the Markdown keeps it
export const secLabel = (s: Section) => s.title;
/** A heading as screen text: no "N-M." prefix, no markup, no § before numbers */
export const screenText = (t: string) => t.replace(/§(?=\d)/g, '');
export const headText = (h: string) => screenText(stripNo(plain(h)));

export const stripNo = (h: string) => h.replace(/^\d+-\d+\.\s*/, '');
// Blocks between an h3 (by id) and the next h3
export function subBlocks(secId: string, h3id: string): Block[] {
  const s = SEC.get(secId);
  if (!s) return [];
  const i = s.blocks.findIndex((b) => b.t === 'h3' && b.id === h3id);
  if (i < 0) return [];
  const out: Block[] = [];
  for (let k = i + 1; k < s.blocks.length && s.blocks[k].t !== 'h3'; k++) out.push(s.blocks[k]);
  return out;
}
export const h3Text = (secId: string, h3id: string) => {
  const b = SEC.get(secId)?.blocks.find((b) => b.t === 'h3' && b.id === h3id);
  return b?.t === 'h3' ? b.text : '';
};

// Raw markdown of one section ("## …" up to the next "## "), without the trailing rule
// Line-level outline of the raw markdown, ignoring anything inside ``` fences
const LINES = md.split('\n');
const OUTLINE: { i: number; level: 2 | 3 | 0; text: string }[] = [];
{
  let fenced = false;
  LINES.forEach((l, i) => {
    if (l.startsWith('```')) fenced = !fenced;
    else if (!fenced && l.startsWith('## ')) OUTLINE.push({ i, level: 2, text: l.slice(3) });
    else if (!fenced && l.startsWith('### ')) OUTLINE.push({ i, level: 3, text: l.slice(4) });
    else if (!fenced && l.trim() === '---') OUTLINE.push({ i, level: 0, text: '' });
  });
}
const slice = (k: number, stop: (level: number) => boolean) => {
  const end = OUTLINE.slice(k + 1).find((o) => stop(o.level))?.i ?? LINES.length;
  return LINES.slice(OUTLINE[k].i, end).join('\n').trim();
};
// Raw markdown of one section ("## …" up to the next "## "), without the trailing rule
export const rawSection = (id: string) => {
  const n = guide.sections.findIndex((s) => s.id === id);
  const h2 = OUTLINE.filter((o) => o.level === 2)[n];
  const k = h2 ? OUTLINE.indexOf(h2) : -1;
  return k < 0
    ? ''
    : slice(k, (l) => l === 2)
        .replace(/\n---$/, '')
        .trim();
};
// Raw markdown of one h3 subsection ("### N-M. …" up to the next heading of level ≤ 3 or a rule)
export const rawSub = (h3id: string) => {
  const k = OUTLINE.findIndex((o) => o.level === 3 && o.text.startsWith(`${h3id}.`));
  return k < 0 ? '' : slice(k, () => true);
};
export const rawGuide = md;

// Review freshness: sections not reviewed for STALE_MONTHS are flagged at build time and on their pages
export const STALE_MONTHS = 12;
export function monthsSince(checked: string, now = new Date()) {
  const m = checked.match(/^(\d{4})年(\d{1,2})月$/);
  return m ? (now.getFullYear() - Number(m[1])) * 12 + (now.getMonth() + 1 - Number(m[2])) : Number.POSITIVE_INFINITY;
}
export const isStale = (s: Section) => !!s.num && monthsSince(s.checked) >= STALE_MONTHS;
{
  const stale = guide.sections.filter(isStale).map((s) => `§${s.num}（${s.checked || '確認なし'}）`);
  if (stale.length) console.warn(`[stackbook] ${STALE_MONTHS}か月以上見直していないセクション: ${stale.join('、')}`);
}

/** Names for section and subsection numbers ("2" → 言語の決め方…, "2-10" → バックエンドの言語の決め方): references show these */
export const TITLES: Record<string, string> = Object.fromEntries(
  guide.sections.flatMap((s) => [
    [s.id, s.title],
    ...s.blocks.flatMap((b) => (b.t === 'h3' && /^\d+-\d+$/.test(b.id) ? [[b.id, headText(b.text)]] : [])),
  ]),
);
// Rendering on the server reads the names from here; the make island sets the same names from its payload
(globalThis as { __stackbookTitles?: Record<string, string> }).__stackbookTitles = TITLES;

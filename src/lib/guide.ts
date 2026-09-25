import md from '../../content/guide.md?raw';
import { plain } from './text';

export { plain };

export type Block =
  | { t: 'h3'; id: string; text: string }
  | { t: 'h4'; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul' | 'ol' | 'check'; items: string[] }
  | { t: 'code' | 'mermaid'; text: string }
  | { t: 'table'; head: string[]; rows: string[][] };

export type Section = { id: string; num: string; title: string; blocks: Block[] };
export type Guide = { title: string; meta: string[]; sections: Section[] };

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|+|\|+$/g, '')
    .split('|')
    .map((c) => c.trim());

// Parses guide.md into structured data. Section ids: "2" for "## 2. …", "intro", "memo".
export function parseGuide(src: string): Guide {
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
      cur = { id, num: m ? m[1] : '', title: m ? m[2] : h, blocks: [] };
      sections.push(cur);
      i++;
    } else if (L.startsWith('#### ')) {
      flush();
      push({ t: 'h4', text: L.slice(5).trim() });
      i++;
    } else if (L.startsWith('### ')) {
      flush();
      const h = L.slice(4).trim();
      const m = h.match(/^(\d+-\d+)\./);
      push({ t: 'h3', id: m ? m[1] : `h${cur?.blocks.length ?? 0}`, text: h });
      i++;
    } else if (L.startsWith('```')) {
      flush();
      push({ t: L.startsWith('```mermaid') ? 'mermaid' : 'code', text: fence() });
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
export const GROUP_LABEL: Record<Group, string> = { tools: '分野', read: '考え方', kit: '手元' };
export const groupOf = (id: string): Group =>
  (Object.keys(GROUPS) as Group[]).find((g) => (GROUPS[g] as readonly string[]).includes(id)) ?? 'read';

export const secLabel = (s: Section) => (s.num ? `§${s.num} ` : '') + s.title;
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

// First paragraph of a section as plain text, for previews
export const firstText = (id: string) => {
  const b = SEC.get(id)?.blocks.find((x) => x.t === 'p');
  return b?.t === 'p' ? plain(b.text) : '';
};

// Raw markdown of one section ("## …" up to the next "## "), without the trailing rule
export const rawSection = (id: string) => {
  const parts = md.split(/^(?=## )/m).slice(1);
  const i = guide.sections.findIndex((s) => s.id === id);
  return i < 0 ? '' : parts[i].replace(/\n---\s*$/, '').trim();
};
// Raw markdown of one h3 subsection ("### N-M. …" up to the next heading of level ≤ 3)
export const rawSub = (h3id: string) => {
  const m = md.match(new RegExp(`^### ${h3id.replace('-', '\\-')}\\.[\\s\\S]*?(?=^#{2,3} |^---$|(?![\\s\\S]))`, 'm'));
  return m ? m[0].trim() : '';
};
export const rawGuide = md;

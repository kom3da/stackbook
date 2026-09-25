import { type Block, SEC, SECS, type Section, stripNo, subBlocks } from './guide';
import { norm, same, tokens } from './text';

export { norm, same, tokens };

export type Alt = { label: string; cond: string; names: string[] };
export type ChoiceRow = {
  sec: Section;
  sub: { id: string; text: string } | null;
  block: Block;
  role: string;
  def: string;
  names: string[];
  alts: Alt[];
  note: string;
};
export type Use = { sub: string; situation: string; detail: string };
export type Tool = {
  name: string;
  slug: string;
  def: ChoiceRow[];
  alt: { row: ChoiceRow; alt: Alt }[];
  uses: Use[];
  lang?: { ref: string; lead: string };
};

export function parseAlts(t: string) {
  const alts: Alt[] = [];
  let note = '';
  if (!t || t === '—') return { alts, note };
  for (const part of t
    .split(/(?<=。)/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const p = part.replace(/。$/, '');
    const i = p.indexOf('：');
    if (i > 0 && /[A-Za-z]/.test(p.slice(0, i)))
      alts.push({ label: p.slice(0, i), cond: p.slice(i + 1), names: tokens(p.slice(0, i)) });
    else if (p.length <= 30 && /^[A-Za-z]/.test(p) && !/[はをがで]/.test(p))
      alts.push({ label: p, cond: '', names: tokens(p) });
    else note += (note ? ' ' : '') + part.replace(/^—\s*/, '');
  }
  return { alts, note };
}
const subOf = (blocks: Block[], idx: number) => {
  for (let k = idx; k >= 0; k--) {
    const b = blocks[k];
    if (b.t === 'h3') return { id: b.id, text: b.text };
  }
  return null;
};
const bold = (t: string) => [...t.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]);

export const ROWS: ChoiceRow[] = [];
export const TOOLS = new Map<string, Tool>();
const tool = (name: string) => {
  const k = norm(name);
  let t = TOOLS.get(k);
  if (!t) {
    t = { name: name.replace(/ \d+$/, ''), slug: '', def: [], alt: [], uses: [] };
    TOOLS.set(k, t);
  }
  return t;
};

for (let n = 1; n <= 18; n++) {
  const s = SEC.get(String(n));
  if (!s) continue;
  s.blocks.forEach((b, bi) => {
    if (b.t !== 'table') return;
    const sub = subOf(s.blocks, bi);
    // "Role | Default | Alternatives" tables
    if (/^既定/.test(b.head[1] ?? '')) {
      for (const r of b.rows) {
        const bs = bold(r[1]);
        const { alts, note } = parseAlts(r[2] ?? '');
        const row: ChoiceRow = {
          sec: s,
          sub,
          block: b,
          role: r[0],
          def: r[1],
          names: [...new Set((bs.length ? bs : [r[1]]).flatMap(tokens))],
          alts,
          note,
        };
        ROWS.push(row);
        for (const name of row.names) tool(name).def.push(row);
        for (const a of alts) for (const name of a.names) tool(name).alt.push({ row, alt: a });
      }
    }
    // §2-10 decision tables: "constraint → language" and "load → first choice"
    if (s.id === '2' && sub && (b.head[0] === '制約' || b.head[0] === '負荷の性質')) {
      for (const r of b.rows)
        for (const name of bold(r[1]).flatMap(tokens))
          tool(name).uses.push({ sub: sub.id, situation: r[0], detail: r[4] ?? '' });
    }
  });
}
// Language entries from §2-1 … §2-8
for (const b of SEC.get('2')?.blocks ?? []) {
  if (b.t !== 'h3' || !/^2-[1-8]$/.test(b.id)) continue;
  const name = stripNo(b.text).replace(/（.*$/, '').split(' / ').pop() as string;
  const lead = subBlocks('2', b.id).find((x) => x.t === 'p');
  tool(name).lang = { ref: b.id, lead: lead?.t === 'p' ? lead.text : '' };
}

// Assign stable, unique URL slugs
const used = new Set<string>();
for (const t of [...TOOLS.values()].sort((a, b) => a.name.localeCompare(b.name))) {
  const base =
    norm(t.name)
      .replace(/#/g, 'sharp')
      .replace(/\+/g, 'plus')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'tool';
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
  used.add(slug);
  t.slug = slug;
}

type Keyed = { keys: string[]; r: string[]; head: string[] };
const tableIn = (secId: string, h3?: string) =>
  (h3 ? subBlocks(secId, h3) : (SEC.get(secId)?.blocks ?? [])).find((b) => b.t === 'table');
const keyed = (b: Block | undefined, split: (k: string) => string[]): Keyed[] =>
  b?.t === 'table' ? b.rows.map((r) => ({ keys: split(r[0]), r, head: b.head })) : [];

export const WHY = keyed(tableIn(SECS.why, SECS.whyTools), (k) => [k.replace(/（.*$/, ''), ...tokens(k)]);
export const COST = keyed(tableIn(SECS.cost), (k) => k.split('／'));
export const MOVE = keyed(tableIn(SECS.growth), (k) => tokens(k));
export const PROF = keyed(tableIn(SECS.prof), (k) => k.split(' / '));
const find = (list: Keyed[], name: string) => list.filter((e) => e.keys.some((k) => same(k, name)));

export type ToolInfo = {
  name: string;
  t?: Tool;
  why: Keyed[];
  cost: Keyed[];
  move: Keyed[];
  prof: Keyed[];
};
export function toolInfo(name: string): ToolInfo {
  const t = TOOLS.get(norm(name)) ?? [...TOOLS.values()].find((x) => same(x.name, name));
  return {
    name: t?.name ?? name,
    t,
    why: find(WHY, name),
    cost: find(COST, name),
    move: find(MOVE, name),
    prof: find(PROF, name),
  };
}
export const hasInfo = (i: ToolInfo) => !!(i.t || i.why.length || i.cost.length || i.move.length || i.prof.length);

// Category shown in the dictionary: languages first, otherwise the section where it is a default
export function category(t: Tool): string {
  if (t.lang) return '言語';
  const r = t.def[0] ?? t.alt[0]?.row;
  if (!r) return 'その他';
  if (r.sec.id === '2') return r.sub?.id === '2-9' ? '言語' : stripNo(r.sub?.text ?? '').replace(/（.*$/, '');
  return r.sec.title.replace(/（.*$/, '');
}
export const dictionary = () =>
  [...TOOLS.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

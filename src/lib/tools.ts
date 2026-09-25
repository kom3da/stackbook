// Dictionary index built from the tool registry and the data blocks that reference tool ids
import { type Block, guide, REGISTRY, type Section, stripNo, subBlocks } from './guide';
import type { Data } from './schema';

type Rows<K extends Data['kind']> = Extract<Data, { kind: K }>['rows'][number];
type Sub = { id: string; text: string } | null;
type At = { sec: Section; sub: Sub; block: Block };

export type ChoiceRow = Rows<'choices'> & At;
export type Tool = {
  id: string;
  name: string;
  slug: string;
  lang?: { ref: string; lead: string };
  def: ChoiceRow[];
  alt: { row: ChoiceRow; alt: ChoiceRow['alts'][number] }[];
  uses: (Rows<'uses'> & { sub: string })[];
  why: Rows<'rationale'>[];
  cost: Rows<'cost'>[];
  growth: Rows<'growth'>[];
  prof: Rows<'prof'>[];
  stacks: (Rows<'stack'> & { sub: Sub })[];
};

export const TOOLS = new Map<string, Tool>(
  [...REGISTRY].map(([id, r]) => [
    id,
    { id, name: r.name, slug: id, def: [], alt: [], uses: [], why: [], cost: [], growth: [], prof: [], stacks: [] },
  ]),
);
const get = (id: string) => TOOLS.get(id) as Tool; // ids are validated in guide.ts

/** Every choice row, in document order */
export const ROWS: ChoiceRow[] = [];

const subOf = (blocks: Block[], idx: number): Sub => {
  for (let k = idx; k >= 0; k--) {
    const b = blocks[k];
    if (b.t === 'h3') return { id: b.id, text: b.text };
  }
  return null;
};

for (const sec of guide.sections)
  sec.blocks.forEach((block, bi) => {
    if (block.t !== 'data') return;
    const d = block.d;
    const sub = subOf(sec.blocks, bi);
    switch (d.kind) {
      case 'choices':
        for (const r of d.rows) {
          const row: ChoiceRow = { ...r, sec, sub, block };
          ROWS.push(row);
          for (const id of r.tools) get(id).def.push(row);
          for (const a of r.alts) for (const id of a.tools) get(id).alt.push({ row, alt: a });
        }
        break;
      case 'uses':
        for (const r of d.rows) for (const id of r.tools) get(id).uses.push({ ...r, sub: sub?.id ?? '' });
        break;
      case 'rationale':
        for (const r of d.rows) for (const id of r.tools) get(id).why.push(r);
        break;
      case 'cost':
        for (const r of d.rows) for (const id of r.tools) get(id).cost.push(r);
        break;
      case 'growth':
        for (const r of d.rows) for (const id of r.tools) get(id).growth.push(r);
        break;
      case 'prof':
        for (const r of d.rows) for (const id of r.tools) get(id).prof.push(r);
        break;
      case 'stack':
        for (const r of d.rows) for (const id of r.tools) get(id).stacks.push({ ...r, sub });
        break;
    }
  });

// Languages: registry entries with `lang` point at their §2-N subsection
for (const [id, r] of REGISTRY) {
  if (!r.lang) continue;
  const lead = subBlocks('2', r.lang).find((b) => b.t === 'p');
  get(id).lang = { ref: r.lang, lead: lead?.t === 'p' ? lead.text : '' };
}

export const hasInfo = (t: Tool) =>
  !!(
    t.lang ||
    t.def.length ||
    t.alt.length ||
    t.uses.length ||
    t.why.length ||
    t.cost.length ||
    t.growth.length ||
    t.prof.length
  );

// Category shown in the dictionary: languages first, otherwise the section where it is a default
export function category(t: Tool): string {
  if (t.lang) return '言語';
  const r = t.def[0] ?? t.alt[0]?.row;
  if (r) {
    if (r.sec.id === '2') return r.sub?.id === '2-9' ? '言語' : stripNo(r.sub?.text ?? '').replace(/（.*$/, '');
    return r.sec.title.replace(/（.*$/, '');
  }
  if (t.stacks.length) return 'ケース別の構成';
  return 'その他';
}

/** Tools that the guide actually says something about, sorted by name */
export const dictionary = () =>
  [...TOOLS.values()]
    .filter((t) => hasInfo(t) || t.stacks.length)
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

const byName = new Map([...TOOLS.values()].map((t) => [t.name, t]));
/** Slug for a display name, for linking names that appear in text */
export const slugOfName = (name: string) => byName.get(name)?.slug;
export const namesOf = (ids: string[]) => ids.map((id) => get(id).name);

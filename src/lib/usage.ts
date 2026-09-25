// Where a tool shows up outside its own rows: the make pages' answers and §23's rules of thumb
import { diffs } from './diff';
import { SEC, SECS } from './guide';
import { findName } from './inline';
import { LOOKUP } from './lookup';
import { TOOLS } from './tools';
import { type Answers, DEFAULTS, decide, KINDS, type Kind, resolve } from './wizard';

export type MakeUse = { kind: string; href: string; layer: string; edited: boolean; when?: string };
export type Rule = { sub: string; cells: [string, string][] };

// Only non-default answers go into the URL, as on the make page
const query = (a: Answers) => {
  const u = new URLSearchParams();
  for (const k of ['load', 'env', 'team', 'stage'] as const) if (a[k] !== DEFAULTS[k]) u.set(k, a[k]);
  if (a.cons.length) u.set('cons', a.cons.join(','));
  const s = u.toString();
  return s ? `?${s}` : '';
};
const rows = (k: Kind, a: Answers) => decide(k, a).tables.flatMap((t) => resolve(t, LOOKUP));

/** Per tool: each kind's default answer that uses it, and each one-condition change that brings it in */
export const MAKE_USES = new Map<string, MakeUse[]>();
{
  const add = (id: string, u: MakeUse) => MAKE_USES.set(id, [...(MAKE_USES.get(id) ?? []), u]);
  for (const [k, name] of KINDS) {
    const base = rows(k, DEFAULTS);
    const inBase = new Set(base.flatMap((r) => r.tools));
    for (const r of base)
      for (const id of r.tools) add(id, { kind: name, href: `/make/${k}/`, layer: r.layer, edited: !!r.edited });
    const seen = new Set<string>();
    for (const x of diffs(k, DEFAULTS, LOOKUP))
      for (const r of rows(k, x.answers))
        for (const id of r.tools)
          if (!inBase.has(id) && !seen.has(`${id}|${r.layer}`)) {
            seen.add(`${id}|${r.layer}`);
            add(id, {
              kind: name,
              href: `/make/${k}/${query(x.answers)}`,
              layer: r.layer,
              edited: !!r.edited,
              when: x.label,
            });
          }
  }
}

/** Per tool: the §23 rows that name it */
export const RULES = new Map<string, Rule[]>();
{
  let sub: string = SECS.numbers;
  for (const b of SEC.get(SECS.numbers)?.blocks ?? []) {
    if (b.t === 'h3') sub = b.id;
    if (b.t !== 'table') continue;
    for (const row of b.rows)
      for (const t of TOOLS.values())
        if (t.name.length > 1 && row.some((c) => findName(c, t.name)))
          RULES.set(t.id, [
            ...(RULES.get(t.id) ?? []),
            { sub, cells: b.head.map((h, i) => [h, row[i] ?? ''] as [string, string]) },
          ]);
  }
}

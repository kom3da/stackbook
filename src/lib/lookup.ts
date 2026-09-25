// Build-time lookup that resolves wizard sources against the guide's data blocks
import { SEC, SECS } from './guide';
import { ROWS } from './tools';
import type { Lookup, Row } from './wizard';

type Plain = Omit<Row, 'ref'>;

/** §19 stack tables by case id ("19-4") */
export const CASE_ROWS = new Map<string, Plain[]>();
{
  let sub = '';
  for (const b of SEC.get(SECS.cases)?.blocks ?? []) {
    if (b.t === 'h3') sub = b.id;
    else if (b.t === 'data' && b.d.kind === 'stack')
      CASE_ROWS.set(
        sub,
        b.d.rows.map((r) => ({ layer: r.layer, text: r.pick, tools: r.tools })),
      );
  }
}

/** Choice rows by "at|role", where at is the subsection id (e.g. "2-1") or the section id when there is none */
export const CHOICES = new Map<string, Plain & { layer: '' }>(
  ROWS.map((r) => [`${r.sub?.id ?? r.sec.id}|${r.role}`, { layer: '', text: r.default, tools: r.tools }]),
);

export const LOOKUP: Lookup = {
  caseRows: (c) => CASE_ROWS.get(c),
  choice: (at, role) => CHOICES.get(`${at}|${role}`),
};

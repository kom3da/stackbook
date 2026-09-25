// Where the guide refers to a section: every §N / §N-M / §N-M 手順K, with the subsection it appears in
import { guide } from './guide';
import { segments } from './inline';

export type Backlink = { fromSec: string; fromSub?: string; step?: string; target: string };

// Every string inside a block (paragraphs, list items, table cells, data rows)
const strings = (v: unknown): string[] =>
  typeof v === 'string'
    ? [v]
    : Array.isArray(v)
      ? v.flatMap(strings)
      : v && typeof v === 'object'
        ? Object.values(v).flatMap(strings)
        : [];

export function backlinks(secId: string): Backlink[] {
  const out = new Map<string, Backlink>();
  for (const s of guide.sections) {
    if (s.id === secId) continue;
    let sub: string | undefined;
    let step: string | undefined;
    for (const b of s.blocks) {
      if (b.t === 'h3') {
        sub = /^\d+-\d+$/.test(b.id) ? b.id : undefined;
        step = undefined;
        continue;
      }
      if (b.t === 'h4') step = b.text.match(/^手順(\d+)/)?.[1];
      for (const text of strings(b.t === 'data' ? b.d : b))
        for (const x of segments(text))
          if (x.t === 'ref' && x.sec === secId) {
            const l = { fromSec: s.id, fromSub: sub, step, target: x.sub ?? x.sec };
            out.set(`${l.fromSec}|${l.fromSub}|${l.step}|${l.target}`, l);
          }
    }
  }
  return [...out.values()];
}

// Build-time payload for a "make" page: everything any answer combination can show
import { h3Text, plain, SEC, SECS, stripNo, subBlocks } from './guide';
import { secHref } from './html';
import type { MakePayload } from './make';
import { blocks, toolBody } from './render';
import { hasInfo, tokens, toolInfo } from './tools';
import { allAnswers, decide, type Kind } from './wizard';

export function makePayload(kind: Kind): MakePayload {
  const p: MakePayload = { cards: {}, cases: {}, cmds: {}, refs: {}, prof: SECS.prof };
  const s19 = SEC.get('19');
  const cmdSec = SEC.get(SECS.commands);
  for (const a of allAnswers(kind)) {
    const d = decide(kind, a);
    for (const [, val] of d.rows)
      for (const n of tokens(val)) {
        if (n in p.cards) continue;
        const i = toolInfo(n);
        if (!hasInfo(i)) continue;
        p.cards[n] = {
          slug: i.t?.slug ?? '',
          name: i.name,
          html: toolBody(i),
          prof: i.prof.map((e) => e.r[0]),
        };
      }
    for (const c of d.cases) {
      if (!s19 || c in p.cases) continue;
      const bl = subBlocks('19', c).filter((b) => b.t === 'mermaid' || b.t === 'p');
      p.cases[c] = { title: stripNo(plain(h3Text('19', c))), href: secHref('19', c), html: blocks(bl, s19) };
    }
    for (const r of d.refs) {
      if (r in p.refs) continue;
      const [n, sub] = r.split('-');
      const s = SEC.get(n);
      if (!s) continue;
      p.refs[r] = {
        href: secHref(n, sub ? r : undefined),
        label: `§${r} ${sub ? stripNo(plain(h3Text(n, r))) : s.title}`,
      };
    }
  }
  // Commands: common setup plus the blocks whose heading references a §19 case
  for (const b of cmdSec?.blocks ?? []) {
    if (b.t !== 'h3' || !cmdSec) continue;
    const key = b.id === SECS.commandsCommon ? '' : (b.text.match(/§(19-\d+)/)?.[1] ?? null);
    if (key === null) continue;
    p.cmds[key] = { title: stripNo(plain(b.text)), html: blocks(subBlocks(SECS.commands, b.id), cmdSec) };
  }
  return p;
}

// Build-time payload for a "make" page: everything any answer combination can show
import type { MakePayload } from '../components/MakeApp';
import { type Block, h3Text, plain, SEC, SECS, stripNo, subBlocks } from './guide';
import { iconOf } from './icons';
import { secHref } from './inline';
import { CASE_ROWS, CHOICES, LOOKUP } from './lookup';
import { dictionary, hrefOf } from './tools';
import { toolView } from './view';
import { allAnswers, decide, type Kind, resolve, sources, srcKey } from './wizard';

const listed = new Map(dictionary().map((t) => [t.id, t]));

export function makePayload(kind: Kind): MakePayload {
  const p: MakePayload = {
    tools: {},
    links: {},
    cases: {},
    cmds: {},
    refs: {},
    caseRows: {},
    choices: {},
    sec: { prof: SECS.prof, cases: SECS.cases, commands: SECS.commands, commandsCommon: SECS.commandsCommon },
  };
  const addLink = (id: string) => {
    const t = listed.get(id);
    if (t) p.links[id] = { name: t.name, href: hrefOf(t) };
  };
  const linkBlocks = (bl: Block[]) => {
    for (const b of bl) if (b.t === 'data') for (const r of b.d.rows) for (const id of r.tools) addLink(id);
  };
  for (const a of allAnswers(kind)) {
    const d = decide(kind, a);
    // Only the data this kind can reach is shipped to the browser
    for (const t of d.tables) if (t.base) p.caseRows[t.base] ??= CASE_ROWS.get(t.base) ?? [];
    for (const src of sources(d)) {
      if ('case' in src) p.caseRows[src.case] ??= CASE_ROWS.get(src.case) ?? [];
      else if ('at' in src) {
        const k = srcKey(src);
        const v = CHOICES.get(k);
        if (!v) throw new Error(`Wizard refers to a missing row: ${k}`);
        p.choices[k] = v;
      }
    }
    const rows = d.tables.flatMap((t) => resolve(t, LOOKUP));
    for (const row of rows)
      for (const id of row.tools) {
        const t = listed.get(id);
        if (!t || id in p.tools) continue;
        const v = { ...toolView(t), icon: iconOf(id) };
        p.tools[id] = v;
        // Names mentioned inside the card (alternatives, defaults, growth targets) link too
        for (const x of [
          id,
          ...v.def.flatMap((r) => [...r.tools, ...r.alts.flatMap((al) => al.tools)]),
          ...v.alt.flatMap((r) => r.tools),
          ...v.growth.flatMap((g) => g.to_tools),
          ...v.stacks.flatMap((s) => s.tools),
        ])
          addLink(x);
      }
    for (const c of d.cases) {
      if (c in p.cases) continue;
      const blocks = subBlocks(SECS.cases, c).filter((b) => b.t === 'mermaid' || b.t === 'p');
      p.cases[c] = { title: stripNo(plain(h3Text(SECS.cases, c))), href: secHref(SECS.cases, c), blocks };
    }
    for (const r of d.refs) {
      if (r in p.refs) continue;
      const [n, sub] = r.split('-');
      const s = SEC.get(n);
      if (s)
        p.refs[r] = {
          href: secHref(n, sub ? r : undefined),
          label: `§${r} ${sub ? stripNo(plain(h3Text(n, r))) : s.title}`,
        };
    }
  }
  // Commands: every §26 subsection by id; the wizard picks which ones to show
  for (const b of SEC.get(SECS.commands)?.blocks ?? []) {
    if (b.t !== 'h3') continue;
    const blocks = subBlocks(SECS.commands, b.id);
    linkBlocks(blocks);
    p.cmds[b.id] = { title: stripNo(plain(b.text)).replace(/（§19-\d+）$/, ''), blocks };
  }
  return p;
}

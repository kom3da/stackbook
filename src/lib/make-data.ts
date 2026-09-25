// Build-time payload for a "make" page: everything any answer combination can show
import type { MakePayload } from '../components/MakeApp';
import { type Block, h3Text, plain, SEC, SECS, stripNo, subBlocks } from './guide';
import { secHref } from './inline';
import { dictionary } from './tools';
import { toolView } from './view';
import { allAnswers, decide, type Kind } from './wizard';

const listed = new Map(dictionary().map((t) => [t.id, t]));

export function makePayload(kind: Kind): MakePayload {
  const p: MakePayload = {
    tools: {},
    links: {},
    cases: {},
    cmds: {},
    refs: {},
    sec: { prof: SECS.prof, cases: SECS.cases, commands: SECS.commands },
  };
  const addLink = (id: string) => {
    const t = listed.get(id);
    if (t) p.links[id] = { name: t.name, slug: t.slug };
  };
  const linkBlocks = (bl: Block[]) => {
    for (const b of bl) if (b.t === 'data') for (const r of b.d.rows) for (const id of r.tools) addLink(id);
  };
  for (const a of allAnswers(kind)) {
    const d = decide(kind, a);
    for (const row of d.rows)
      for (const id of row.tools) {
        const t = listed.get(id);
        if (!t || id in p.tools) continue;
        const v = toolView(t);
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
  // Commands: common setup plus the blocks whose heading references a §19 case
  for (const b of SEC.get(SECS.commands)?.blocks ?? []) {
    if (b.t !== 'h3') continue;
    const key = b.id === SECS.commandsCommon ? '' : (b.text.match(/§(19-\d+)/)?.[1] ?? null);
    if (key === null) continue;
    const blocks = subBlocks(SECS.commands, b.id);
    linkBlocks(blocks);
    p.cmds[key] = { title: stripNo(plain(b.text)), blocks };
  }
  return p;
}

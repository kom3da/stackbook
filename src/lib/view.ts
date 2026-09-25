// Serializable view models shared by static pages and the "make" island (no references to sections)
import { plain, SECS, stripNo } from './guide';
import { secHref } from './inline';
import { type ChoiceRow, category, dictionary, type Tool } from './tools';

type Alt = ChoiceRow['alts'][number];
export type Where = { href: string; label: string };
export type ChoiceView = { role: string; default: string; tools: string[]; alts: Alt[]; note?: string; where: Where };
export type ToolView = {
  id: string;
  name: string;
  slug: string;
  category: string;
  lang?: { ref: string; lead: string };
  uses: { situation: string; reason?: string }[];
  def: ChoiceView[];
  alt: (ChoiceView & { when?: string })[];
  why: { why: string; concern?: string }[];
  cost: { axis: string; grows: string; action: string }[];
  growth: { to: string; to_tools: string[]; trigger: string; prepare: string }[];
  stacks: { label: string; layer: string; pick: string; tools: string[] }[];
  /** Proficiency keys (§27 names) that cover this tool */
  prof: string[];
  refs: { why: string; whySub: string; cost: string; growth: string };
};

const where = (r: ChoiceRow): Where => ({
  href: secHref(r.sec.id, r.sub?.id),
  label: r.sub ? stripNo(plain(r.sub.text)) : r.sec.title,
});
const choice = (r: ChoiceRow): ChoiceView => ({
  role: r.role,
  default: r.default,
  tools: r.tools,
  alts: r.alts,
  note: r.note,
  where: where(r),
});

export const toolView = (t: Tool): ToolView => ({
  id: t.id,
  name: t.name,
  slug: t.slug,
  category: category(t),
  lang: t.lang,
  uses: t.uses.map((u) => ({ situation: u.situation, reason: u.reason })),
  def: t.def.map(choice),
  alt: t.alt.map(({ row, alt }) => ({ ...choice(row), when: alt.when })),
  why: t.why.map((w) => ({ why: w.why, concern: w.concern })),
  cost: t.cost.map((c) => ({ axis: c.axis, grows: c.grows, action: c.action })),
  growth: t.growth.map((g) => ({ to: g.to, to_tools: g.to_tools, trigger: g.trigger, prepare: g.prepare })),
  stacks: t.stacks.map((s) => ({
    label: s.sub ? stripNo(plain(s.sub.text)) : '',
    layer: s.layer,
    pick: s.pick,
    tools: s.tools,
  })),
  prof: t.prof.map((p) => p.name),
  refs: { why: SECS.why, whySub: SECS.whyTools, cost: SECS.cost, growth: SECS.growth },
});

/** Every dictionary tool, for linking names in static pages */
export const LINKS = Object.fromEntries(dictionary().map((t) => [t.id, { name: t.name, slug: t.slug }]));

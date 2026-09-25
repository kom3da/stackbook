// What changes when one condition differs from the chosen ones; shared by the make page and its Markdown
import { type Answers, type Decision, decide, type Kind, type Lookup, questionsFor, resolve } from './wizard';

export type Diff = {
  q: keyof Answers;
  /** The option this change selects (for cons: the one toggled) */
  v: string;
  /** e.g. 実行環境＝AWS, or 機械学習ライブラリが必須を加える */
  label: string;
  /** The question and option labels, e.g. 実行環境 / AWS */
  qLabel: string;
  opt: string;
  /** The answers with this change applied */
  answers: Answers;
  /** New recommendation, when it changes */
  title?: string;
  /** A §19 case the stack switches to, when it switches */
  base?: string;
  /** The stack is rebuilt from per-language defaults rather than a §19 case */
  rebuilt: boolean;
  /** Rows that differ (all rows when rebuilt), and rows that go away */
  rows: { layer: string; text: string; tools: string[] }[];
  removed: string[];
};

const flat = (d: Decision, look: Lookup) => new Map(d.tables.flatMap((t) => resolve(t, look)).map((r) => [r.layer, r]));
const bases = (d: Decision) => d.tables.map((t) => t.base ?? '').join();

/** One entry per option not currently chosen (for multi-select: toggling each option), in question order */
export function diffs(kind: Kind, from: Answers, look: Lookup): Diff[] {
  const base = decide(kind, from);
  const before = flat(base, look);
  const out: Diff[] = [];
  for (const q of questionsFor(kind))
    for (const [v, label] of q.opts) {
      if (!q.multi && from[q.q] === v) continue;
      const on = q.multi && from.cons.includes(v);
      const answers: Answers = q.multi
        ? { ...from, cons: on ? from.cons.filter((x) => x !== v) : [...from.cons, v] }
        : { ...from, [q.q]: v };
      const d = decide(kind, answers);
      const after = flat(d, look);
      // A different §19 case replaces the stack, unless the current tables all stay (then its rows are additions)
      const kept = base.tables.every((b) => d.tables.some((t) => t.base === b.base && t.title === b.title));
      const other = kept
        ? undefined
        : d.tables.find((t) => t.base && !base.tables.some((b) => b.base === t.base))?.base;
      const rebuilt = !other && !kept && bases(d) !== bases(base);
      const rows = [...after.values()]
        .filter((r) => other || rebuilt || before.get(r.layer)?.text !== r.text)
        .map((r) => ({ layer: r.layer, text: r.text, tools: r.tools }));
      const removed = other || rebuilt ? [] : [...before.keys()].filter((k) => !after.has(k));
      const d2: Diff = {
        q: q.q,
        v,
        label: q.multi ? `${label}を${on ? '外す' : '加える'}` : `${q.label}＝${label}`,
        qLabel: q.label,
        opt: label,
        answers,
        title: d.title !== base.title ? d.title : undefined,
        base: other,
        rebuilt,
        rows,
        removed,
      };
      if (d2.title || d2.base || rows.length || removed.length) out.push(d2);
    }
  return out;
}

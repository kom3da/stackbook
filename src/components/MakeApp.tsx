import { useEffect, useMemo, useRef, useState } from 'react';
import type { Block } from '../lib/guide';
import type { ToolView } from '../lib/view';
import {
  type Answers,
  DEFAULTS,
  type Decision,
  decide,
  KINDS,
  type Kind,
  type Lookup,
  questionsFor,
  resolve,
} from '../lib/wizard';
import { Blocks } from './Blocks';
import { Inline, type Links } from './Inline';
import { ToolBody } from './ToolBody';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from './ui/drawer';

export type MakePayload = {
  tools: Record<string, ToolView>;
  links: Links;
  cases: Record<string, { title: string; href: string; blocks: Block[] }>;
  /** Command blocks keyed by §26 subsection id */
  cmds: Record<string, { title: string; blocks: Block[] }>;
  refs: Record<string, { href: string; label: string }>;
  /** §19 stack rows and choice defaults the wizard can reference, keyed like srcKey() */
  caseRows: Record<string, { layer: string; text: string; tools: string[] }[]>;
  choices: Record<string, { layer: string; text: string; tools: string[] }>;
  /** Section ids used in messages */
  sec: { prof: string; cases: string; commands: string; commandsCommon: string };
};

const PKEY = 'stackbook:prof';
const readProf = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(PKEY) || '{}');
  } catch {
    return {};
  }
};

const SINGLE = ['load', 'env', 'team', 'stage'] as const;
const lastKey = (kind: Kind) => `stackbook:make:${kind}`;

/** Answers from the URL query, keeping only values this kind offers */
function fromQuery(kind: Kind, search: string): Answers | null {
  const u = new URLSearchParams(search);
  if (![...SINGLE, 'cons'].some((k) => u.has(k))) return null;
  const qs = questionsFor(kind);
  const ok = (q: string, v: string | null) => !!v && !!qs.find((x) => x.q === q)?.opts.some((o) => o[0] === v);
  const a: Answers = { ...DEFAULTS, cons: [] };
  for (const k of SINGLE) {
    const v = u.get(k);
    if (ok(k, v)) a[k] = v as string;
  }
  a.cons = (u.get('cons') ?? '').split(',').filter((v) => ok('cons', v));
  return a;
}
/** Only non-default answers go into the URL */
function toQuery(a: Answers) {
  const u = new URLSearchParams();
  for (const k of SINGLE) if (a[k] !== DEFAULTS[k]) u.set(k, a[k]);
  if (a.cons.length) u.set('cons', a.cons.join(','));
  const s = u.toString();
  return s ? `?${s}` : '';
}

export default function MakeApp({ kind, payload: p }: { kind: Kind; payload: MakePayload }) {
  const [answers, setAnswers] = useState<Answers>(DEFAULTS);
  const ready = useRef(false);
  // Conditions come from the URL (shareable); without one, from the last visit
  useEffect(() => {
    let a = fromQuery(kind, location.search);
    if (!a)
      try {
        const saved = localStorage.getItem(lastKey(kind));
        if (saved) a = fromQuery(kind, saved);
      } catch {}
    if (a) setAnswers(a);
    ready.current = true;
  }, [kind]);
  useEffect(() => {
    if (!ready.current) return;
    const q = toQuery(answers);
    history.replaceState(history.state, '', `${location.pathname}${q}${location.hash}`);
    try {
      localStorage.setItem(lastKey(kind), q);
    } catch {}
  }, [answers, kind]);
  const [prof, setProf] = useState<Record<string, string>>({});
  const d = useMemo(() => decide(kind, answers), [kind, answers]);
  const qs = questionsFor(kind);
  const look: Lookup = { caseRows: (c) => p.caseRows[c], choice: (at, role) => p.choices[`${at}|${role}`] };

  useEffect(() => {
    const load = () => setProf(readProf());
    load();
    window.addEventListener(PKEY, load);
    return () => window.removeEventListener(PKEY, load);
  }, []);
  // Let the page script sync selects/checkboxes and draw diagrams after each render
  useEffect(() => {
    window.dispatchEvent(new Event('stackbook:render'));
  });

  const set = (q: keyof Answers, v: string, multi?: boolean) =>
    setAnswers((a) =>
      multi ? { ...a, cons: a.cons.includes(v) ? a.cons.filter((x) => x !== v) : [...a.cons, v] } : { ...a, [q]: v },
    );

  const [open, setOpen] = useState(false);
  const wide = useWide();
  const summary = qs
    .map((q) =>
      q.multi
        ? q.opts
            .filter(([v]) => answers.cons.includes(v))
            .map((o) => o[2])
            .join('・') || '制約なし'
        : q.opts.find(([v]) => answers[q.q] === v)?.[2],
    )
    .join(' · ');

  // The §19 diagrams show each case as written; say so when the table above differs from it
  const diagramNote = (c: string) => {
    const t = d.tables.find((x) => x.base === c);
    if (!t) return '参考として載せている。言語や構成は上の表と異なる場合がある。';
    return t.edits.length ? '§19 の既定の構成の図。「差し替え」の付いた行は図に反映していない。' : '';
  };
  const unknown = new Set<string>();
  const tables = d.tables.map((t) => ({
    ...t,
    rows: resolve(t, look).map((r) => {
      const tools = r.tools.map((id) => p.tools[id]).filter(Boolean);
      const warn = [...new Set(tools.flatMap((x) => x.prof).filter((n) => prof[n] === '未経験'))];
      for (const w of warn) unknown.add(w);
      return { ...r, cards: tools, warn };
    }),
  }));
  // Every tool in the answer, once, for the operations bands
  const bandTools = [...new Map(tables.flatMap((t) => t.rows.flatMap((r) => r.cards)).map((c) => [c.id, c])).values()];

  return (
    <>
      {qs.length > 0 && (
        <div className="cond-bar mt-6">
          <p className="cond-sum">
            <span className="cond-k">条件</span>
            {summary}
          </p>
          <button
            type="button"
            className="cond-btn"
            aria-expanded={open}
            aria-controls={wide ? 'conds' : undefined}
            onClick={() => setOpen((o) => !o)}
          >
            {open && wide ? '閉じる' : '変更'}
          </button>
        </div>
      )}
      {qs.length > 0 && wide && open && (
        <div id="conds" className="cond-panel">
          <Conditions qs={qs} answers={answers} set={set} />
        </div>
      )}
      {qs.length > 0 && !wide && (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="bg-surface">
            <DrawerHeader>
              <DrawerTitle>条件</DrawerTitle>
              <DrawerDescription>選ぶと推奨がすぐ変わる</DrawerDescription>
            </DrawerHeader>
            <div className="max-h-[60vh] overflow-y-auto px-4">
              <Conditions qs={qs} answers={answers} set={set} />
            </div>
            <DrawerFooter>
              <DrawerClose className="cond-btn w-full">閉じる</DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}

      <p className="sr-only" aria-live="polite">
        推奨：{d.title}
      </p>
      <div className="mt-4">
        <section className="answer">
          <div className="flex items-start justify-between gap-3">
            <p className="eyebrow">推奨</p>
            <CopyButton text={() => stackMarkdown(kind, d, tables, summary, bandTools)} />
          </div>
          <p className="ans">{d.title}</p>
          <ul className="why">
            {d.why.map((w) => (
              <li key={w}>
                <Inline text={w} />
              </li>
            ))}
          </ul>
          <Bands tools={bandTools} />
          {d.notes.length > 0 && (
            <ul className="why note">
              {d.notes.map((n) => (
                <li key={n}>
                  <Inline text={n} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="blk">
          <h2 className="sh">
            構成<span className="sh-d">行を開くと詳細（乗り換える条件・根拠・費用・習熟度）</span>
          </h2>
          {tables.map((t) => (
            <div key={t.title ?? t.base ?? 'composed'} className="mt-4 first:mt-0">
              {t.title && <h3 className="sheet-h">{t.title}</h3>}
              <div className="sheet">
                {t.rows.map((r) => {
                  const head = (
                    <>
                      <span className="s-layer">{r.layer}</span>
                      <span className="s-val">
                        <Inline text={r.text} linkTools={false} />
                        {r.edited && <span className="tag">差し替え</span>}
                        {r.warn.map((n) => (
                          <span key={n} className="badge">
                            未経験：{n}
                          </span>
                        ))}
                      </span>
                    </>
                  );
                  if (!r.cards.length)
                    return (
                      <div className="srow" key={r.layer}>
                        <div className="s-head">{head}</div>
                      </div>
                    );
                  return (
                    <details className="srow" key={r.layer}>
                      <summary className="s-head">
                        {head}
                        <span className="chev" aria-hidden="true" />
                      </summary>
                      <div className="s-more">
                        {r.cards.map((t) => (
                          <section className="tcard" key={t.id}>
                            <h3>
                              <a href={t.page ?? t.url}>{t.name}</a>
                            </h3>
                            <ToolBody tool={t} links={p.links} />
                          </section>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
              {t.base && (
                <p className="sheet-src">
                  <a className="ref" href={`/s/${p.sec.cases}/#${t.base}`}>
                    §{t.base}
                  </a>
                  {t.edits.length ? 'の構成を、選んだ条件に合わせて一部差し替えている' : 'の構成'}
                </p>
              )}
            </div>
          ))}
          {unknown.size > 0 && (
            <p className="warn">
              未経験のツールが含まれる。検証期間を見積もりに入れる（
              <a className="ref" href={`/s/${p.sec.prof}/`}>
                §{p.sec.prof}
              </a>
              ）。
            </p>
          )}
        </section>

        {d.cases.map((c) => {
          const x = p.cases[c];
          return (
            x && (
              <section className="blk" key={c}>
                <h2 className="sh">
                  構成図{' '}
                  <a className="ref" href={x.href}>
                    {x.title}
                  </a>
                </h2>
                {diagramNote(c) && <p className="sheet-src">{diagramNote(c)}</p>}
                <Blocks blocks={x.blocks} secId={p.sec.cases} links={p.links} />
              </section>
            )
          );
        })}

        <CommandList keys={[p.sec.commandsCommon, ...d.commands]} p={p} />

        <section className="blk">
          <h2 className="sh">次に読む</h2>
          <div className="nxs">
            {[...new Set(d.refs)].map((r) => {
              const x = p.refs[r];
              return (
                x && (
                  <a className="nx" href={x.href} key={r}>
                    {x.label}
                  </a>
                )
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

function CommandList({ keys, p }: { keys: string[]; p: MakePayload }) {
  const list = keys.map((k) => [k, p.cmds[k]] as const).filter(([, c]) => c);
  if (!list.length) return null;
  return (
    <section className="blk">
      <h2 className="sh">作り始める</h2>
      {list.map(([k, c]) => (
        <div key={k}>
          <h3>{c.title}</h3>
          <Blocks blocks={c.blocks} secId={p.sec.commands} links={p.links} />
        </div>
      ))}
    </section>
  );
}

type Q = ReturnType<typeof questionsFor>[number];
function Conditions({
  qs,
  answers,
  set,
}: {
  qs: Q[];
  answers: Answers;
  set: (q: keyof Answers, v: string, multi?: boolean) => void;
}) {
  return (
    <form className="conds" onSubmit={(e) => e.preventDefault()}>
      {qs.map((q) => (
        <fieldset key={q.q}>
          <legend>{q.label}</legend>
          <div className="chips">
            {q.opts.map(([v, l]) => (
              <label key={v}>
                <input
                  type={q.multi ? 'checkbox' : 'radio'}
                  name={q.q}
                  value={v}
                  checked={q.multi ? answers.cons.includes(v) : answers[q.q] === v}
                  onChange={() => set(q.q, v, q.multi)}
                />
                <span>{l}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </form>
  );
}

// Desktop shows the conditions inline; phones use a bottom sheet
function useWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const m = matchMedia('(min-width: 768px)');
    const on = () => setWide(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

/** The current answer as Markdown, to paste into an AI agent or a README */
function stackMarkdown(
  kind: Kind,
  d: Decision,
  tables: { title?: string; rows: { layer: string; text: string }[] }[],
  summary: string,
  tools: ToolView[],
) {
  const name = KINDS.find((k) => k[0] === kind)?.[1] ?? kind;
  const ops = BANDS.flatMap((b) => {
    const names = tools.filter((t) => t.ops === b.ops).map((t) => t.name);
    return names.length ? [`- ${b.label}：${names.join('、')}`] : [];
  });
  return [
    `# ${name}：${d.title}`,
    '',
    ...(summary ? [`条件：${summary}`, ''] : []),
    ...d.why.map((w) => `- ${w}`),
    ...d.notes.map((n) => `- ${n}`),
    ...tables.flatMap((t) => [
      '',
      ...(t.title ? [`## ${t.title}`, ''] : []),
      '| レイヤー | 採用 |',
      '|---|---|',
      ...t.rows.map((r) => `| ${r.layer} | ${r.text} |`),
    ]),
    ...(ops.length ? ['', '## 運用の内訳', '', ...ops] : []),
    '',
    `出典：${location.href}（バージョンは書いていないので、各ツールの最新安定版を確認する）`,
    '',
  ].join('\n');
}

function CopyButton({ text }: { text: () => string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="cond-btn text-xs"
      onClick={() =>
        navigator.clipboard?.writeText(text()).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })
      }
    >
      {done ? 'コピーしました' : 'Markdownでコピー'}
    </button>
  );
}

const BANDS = [
  { ops: 'code', label: '自分で書く' },
  { ops: 'self', label: '自分で運用する' },
  { ops: 'managed', label: 'マネージドに任せる' },
] as const;

/** The stack split by who runs each part; widths follow the number of tools */
function Bands({ tools }: { tools: ToolView[] }) {
  const groups = BANDS.map((b) => ({ ...b, names: tools.filter((t) => t.ops === b.ops).map((t) => t.name) })).filter(
    (g) => g.names.length,
  );
  if (!groups.length) return null;
  return (
    <div className="bands" role="group" aria-label="運用の内訳">
      {groups.map((g) => (
        <div key={g.ops} className={`band band-${g.ops}`} style={{ flexGrow: g.names.length }}>
          <span className="band-k">
            {g.label}（{g.names.length}）
          </span>
          <span className="band-v">{g.names.join(' · ')}</span>
        </div>
      ))}
    </div>
  );
}

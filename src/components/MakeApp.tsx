import { useEffect, useMemo, useRef, useState } from 'react';
import { type Diff, diffs } from '../lib/diff';
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
import { Inline, type Links, LinksContext } from './Inline';

export type MakeTool = Pick<ToolView, 'id' | 'name' | 'page' | 'ops' | 'prof'>;

export type MakePayload = {
  /** Only what the page shows about each tool; details open in the peek panel */
  tools: Record<string, MakeTool>;
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
/** Only non-default answers go into the URL; other parameters (the open references) are kept */
function toQuery(a: Answers, keep = '') {
  const u = new URLSearchParams(keep);
  for (const k of [...SINGLE, 'cons']) u.delete(k);
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
    history.replaceState(history.state, '', `${location.pathname}${toQuery(answers, location.search)}${location.hash}`);
    try {
      localStorage.setItem(lastKey(kind), toQuery(answers));
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
      <Conditions qs={qs} answers={answers} set={set} />
      <p className="sr-only" aria-live="polite">
        推奨：{d.title}
      </p>
      <div className="mt-4">
        <section className="answer" id="memo">
          <div className="flex items-start justify-between gap-3">
            <p className="eyebrow">1　推奨</p>
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
            <span className="sh-n">2</span>構成
            <span className="sh-d">行を押すと詳細（乗り換える条件・根拠・費用・習熟度）</span>
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
                        <LinksContext.Provider value={p.links}>
                          <Inline
                            text={r.text}
                            tools={r.cards.map((c) => c.id)}
                            linkTools={false}
                            mark={(id) => <OpsMark ops={p.tools[id]?.ops} />}
                          />
                        </LinksContext.Provider>
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
                    <div className="srow" key={r.layer}>
                      <button
                        type="button"
                        className="s-head s-btn"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent('stackbook:peek', {
                              detail: { hrefs: r.cards.flatMap((c) => (c.page ? [c.page] : [])) },
                            }),
                          )
                        }
                      >
                        {head}
                        <span className="chev-r" aria-hidden="true" />
                      </button>
                    </div>
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

        {bandTools.length > 0 && (
          <section className="blk">
            <h2 className="sh">
              <span className="sh-n">3</span>運用の内訳
            </h2>
            <OpsList tools={bandTools} />
          </section>
        )}

        <DiffList
          items={diffs(kind, answers, look)}
          p={p}
          pick={(a) => {
            setAnswers(a);
            document.getElementById('memo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />

        {d.cases.map((c) => {
          const x = p.cases[c];
          return (
            x && (
              <section className="blk" key={c}>
                <h2 className="sh">
                  <span className="sh-n">5</span>構成図{' '}
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
          <h2 className="sh">
            <span className="sh-n">7</span>次に読む
          </h2>
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
      <h2 className="sh">
        <span className="sh-n">6</span>作り始める
      </h2>
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
/** The conditions, always in view: one select per question, checkboxes for the constraints */
function Conditions({
  qs,
  answers,
  set,
}: {
  qs: Q[];
  answers: Answers;
  set: (q: keyof Answers, v: string, multi?: boolean) => void;
}) {
  if (!qs.length) return <p className="conds-none">この種類は、条件によって構成が変わらない。</p>;
  return (
    <form className="conds" aria-label="条件" onSubmit={(e) => e.preventDefault()}>
      {qs.map((q) =>
        q.multi ? (
          <fieldset key={q.q} className="cf cf-multi">
            <legend className="cf-k">{q.label}</legend>
            <div className="cf-opts">
              {q.opts.map(([v, l]) => (
                <label key={v}>
                  <input type="checkbox" checked={answers.cons.includes(v)} onChange={() => set(q.q, v, true)} />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <label key={q.q} className="cf">
            <span className="cf-k">{q.label}</span>
            <select value={answers[q.q] as string} onChange={(e) => set(q.q, e.target.value)}>
              {q.opts.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        ),
      )}
    </form>
  );
}

/** What changes if one condition were different, with a button to switch to it */
function DiffList({ items, p, pick }: { items: Diff[]; p: MakePayload; pick: (a: Answers) => void }) {
  if (!items.length) return null;
  return (
    <section className="blk">
      <h2 className="sh">
        <span className="sh-n">4</span>条件が違うとき
      </h2>
      <ul className="diffs">
        {items.map((x) => (
          <li key={`${x.q}:${x.v}`}>
            <div className="df-h">
              <span className="df-k">{x.label}</span>
              <button type="button" className="cond-btn text-xs" onClick={() => pick(x.answers)}>
                この条件にする
              </button>
            </div>
            <ul className="df-c">
              {x.title && (
                <li>
                  <span className="df-l">推奨</span>
                  <strong>{x.title}</strong>
                </li>
              )}
              {x.base && (
                <li>
                  <span className="df-l">構成</span>
                  <span>
                    <a className="ref" href={`/s/${p.sec.cases}/#${x.base}`}>
                      §{x.base}
                    </a>{' '}
                    {p.cases[x.base]?.title ?? ''} を使う
                  </span>
                </li>
              )}
              {x.rebuilt && (
                <li>
                  <span className="df-l">構成</span>
                  <span>言語別の既定から組み立て直す</span>
                </li>
              )}
              {!x.base &&
                !x.rebuilt &&
                x.rows.map((r) => (
                  <li key={r.layer}>
                    <span className="df-l">{r.layer}</span>
                    <span>
                      <Inline text={r.text} />
                    </span>
                  </li>
                ))}
              {x.removed.map((l) => (
                <li key={l}>
                  <span className="df-l">{l}</span>
                  <span className="text-mute">なくなる</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The current answer as Markdown, to paste into an AI agent or a README */
function stackMarkdown(
  kind: Kind,
  d: Decision,
  tables: { title?: string; rows: { layer: string; text: string }[] }[],
  summary: string,
  tools: MakeTool[],
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

/** Who runs a tool, as a shape (■ write, □ run, dashed ○ managed) with its label for screen readers */
function OpsMark({ ops }: { ops?: MakeTool['ops'] }) {
  const b = BANDS.find((x) => x.ops === ops);
  return b ? <span className={`om om-${b.ops}`} role="img" aria-label={b.label} /> : null;
}

/** The stack split by who runs each part */
function OpsList({ tools }: { tools: MakeTool[] }) {
  const groups = BANDS.map((b) => ({ ...b, names: tools.filter((t) => t.ops === b.ops).map((t) => t.name) })).filter(
    (g) => g.names.length,
  );
  if (!groups.length) return null;
  return (
    <ul className="ops-list" aria-label="運用の内訳">
      {groups.map((g) => (
        <li key={g.ops}>
          <span className="ops-k">
            <span className={`om om-${g.ops}`} aria-hidden="true" />
            {g.label}（{g.names.length}）
          </span>
          <span>{g.names.join('、')}</span>
        </li>
      ))}
    </ul>
  );
}

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { type Diff, diffs } from '../lib/diff';
import type { Block } from '../lib/guide';
import { refText, secHref, segments } from '../lib/inline';
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
  /** Section and subsection names, so references read as names on the client too */
  titles: Record<string, string>;
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
/** Only non-default answers go into the URL; other parameters (the open references, the pinned set) are kept */
function toQuery(a: Answers, keep = '') {
  const u = new URLSearchParams(keep);
  for (const k of [...SINGLE, 'cons']) u.delete(k);
  for (const k of SINGLE) if (a[k] !== DEFAULTS[k]) u.set(k, a[k]);
  if (a.cons.length) u.set('cons', a.cons.join(','));
  const s = u.toString();
  return s ? `?${s}` : '';
}

export default function MakeApp({ kind, payload: p }: { kind: Kind; payload: MakePayload }) {
  (globalThis as { __stackbookTitles?: Record<string, string> }).__stackbookTitles = p.titles;
  const [answers, setAnswers] = useState<Answers>(DEFAULTS);
  // A pinned set of conditions (A) to compare with the current one (B); kept in ?vs= as its own query string
  const [pinned, setPinned] = useState<Answers | null>(null);
  // Scroll to the comparison once it has rendered
  const toCmp = useRef(false);
  useEffect(() => {
    if (!pinned || !toCmp.current) return;
    toCmp.current = false;
    document.getElementById('cmp')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pinned]);
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
    const vs = new URLSearchParams(location.search).get('vs');
    if (vs !== null) setPinned(fromQuery(kind, vs) ?? { ...DEFAULTS, cons: [] });
    ready.current = true;
  }, [kind]);
  useEffect(() => {
    if (!ready.current) return;
    const u = new URLSearchParams(toQuery(answers, location.search));
    if (pinned) u.set('vs', toQuery(pinned).slice(1));
    else u.delete('vs');
    const q = u.toString();
    history.replaceState(history.state, '', `${location.pathname}${q ? `?${q}` : ''}${location.hash}`);
    try {
      localStorage.setItem(lastKey(kind), toQuery(answers));
    } catch {}
  }, [answers, pinned, kind]);
  // Links to other conditions of this kind (e.g. from a tool's make usage) change them in place
  useEffect(() => {
    const on = () => setAnswers(fromQuery(kind, location.search) ?? { ...DEFAULTS, cons: [] });
    window.addEventListener('stackbook:answers', on);
    return () => window.removeEventListener('stackbook:answers', on);
  }, [kind]);
  const d = useMemo(() => decide(kind, answers), [kind, answers]);
  // The home page offers to pick up where the reader left off
  useEffect(() => {
    if (!ready.current) return;
    try {
      localStorage.setItem(
        'stackbook:last',
        JSON.stringify({
          kind,
          url: `${location.pathname}${toQuery(answers)}`,
          title: d.title,
          summary: summaryOf(answers),
        }),
      );
    } catch {}
  }, [kind, answers, d.title]);
  const [prof, setProf] = useState<Record<string, string>>({});
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

  const summaryOf = (a: Answers) =>
    qs
      .map((q) =>
        q.multi
          ? q.opts
              .filter(([v]) => a.cons.includes(v))
              .map((o) => o[2])
              .join('・') || '制約なし'
          : q.opts.find(([v]) => a[q.q] === v)?.[2],
      )
      .join(' · ');
  const summary = summaryOf(answers);

  // The §19 diagrams show each case as written; say so when the table above differs from it
  const diagramNote = (c: string) => {
    const t = d.tables.find((x) => x.base === c);
    if (!t) return '参考として載せている。言語や構成は上の表と異なる場合がある。';
    return t.edits.length ? 'ケース別の構成の既定の図。「差替」の付いた行は図に反映していない。' : '';
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

  const togglePin = () => setPinned((x) => (x ? null : answers));
  const name = KINDS.find((k) => k[0] === kind)?.[1] ?? kind;
  // §references in the reasons, offered in the marginalia
  const grounds = [
    ...new Map(d.why.flatMap((w) => segments(w).flatMap((x) => (x.t === 'ref' ? [[x.v, x] as const] : [])))).values(),
  ];
  const copy = () => stackMarkdown(kind, d, tables, summary, bandTools);

  return (
    <div className="mk">
      <article className="memo" aria-labelledby="memo-h">
        <div className="memo-top">
          <span className="memo-k">判定メモ</span>
          <span className="flex flex-wrap gap-2">
            <CopyButton primary text={copy} />
            {qs.length > 0 && (
              <button type="button" className="btn" aria-pressed={!!pinned} onClick={togglePin}>
                {pinned ? '比較をやめる' : '条件を並べて比べる'}
              </button>
            )}
          </span>
        </div>
        <button type="button" className="kind-pick lg:hidden" aria-haspopup="dialog" data-sheet-open>
          <span className="kind-pick-k">作るもの</span>
          <span className="kind-pick-v">{name}</span>
        </button>
        <h1 className="memo-h" id="memo-h">
          {name} を作る
        </h1>
        <Conditions qs={qs} answers={answers} set={set} />
        <hr className="memo-rule" />
        {pinned && (
          <Compare
            kind={kind}
            a={pinned}
            b={answers}
            look={look}
            p={p}
            summaryOf={summaryOf}
            restore={() => setAnswers(pinned)}
            unpin={() => setPinned(null)}
          />
        )}
        <p className="sr-only" aria-live="polite">
          推奨：{d.title}
        </p>

        <Sec id="m1" title="推奨言語">
          <p className="ans">{d.title}</p>
          {d.why.map((w) => (
            <p className="ans-why" key={w}>
              <Inline text={w} />
            </p>
          ))}
          {d.notes.length > 0 && (
            <ul className="ans-notes">
              {d.notes.map((n) => (
                <li key={n}>
                  <Inline text={n} />
                </li>
              ))}
            </ul>
          )}
        </Sec>

        <Sec id="m2" title="構成">
          <LinksContext.Provider value={p.links}>
            {tables.map((t) => (
              <div key={t.title ?? t.base ?? 'composed'} className="st-wrap">
                {t.title && <h3 className="sheet-h">{t.title}</h3>}
                <table className="st">
                  <tbody>
                    {t.rows.map((r) => {
                      // Plain throughout: the sources bold some names and not others
                      const [main, note] = splitNote(r.text.replaceAll('**', ''));
                      const ids = r.cards.map((c) => c.id);
                      return (
                        <tr key={r.layer} className={r.edited ? 'st-ed' : undefined}>
                          <td className="st-b">{r.edited && <span className="ed-badge">差替</span>}</td>
                          <th scope="row">{r.layer}</th>
                          <td className="st-t">
                            <Inline text={main} tools={ids} />
                          </td>
                          <td className="st-n">
                            {note && <Inline text={note} tools={ids} />}
                            {r.warn.map((n) => (
                              <span key={n} className="badge">
                                未経験：{n}
                              </span>
                            ))}
                          </td>
                          <td className="st-m">
                            {[...new Set(r.cards.map((c) => c.ops))].map((o) => (
                              <OpsMark key={o ?? ''} ops={o} />
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {t.base && (
                  <p className="sheet-src">
                    <a className="ref" href={`/s/${p.sec.cases}/#${t.base}`}>
                      {p.titles[t.base] ?? t.base}
                    </a>
                    {t.edits.length ? 'の構成を、選んだ条件に合わせて一部差し替えている' : 'の構成'}
                  </p>
                )}
              </div>
            ))}
          </LinksContext.Provider>
          {/* Below the wide layout the sidenote's key would land at the page's end; it belongs beside the table */}
          <Legend className="st-key xl:hidden" />
        </Sec>

        {d.cases.length > 0 && (
          <Sec id="m3" title="構成図">
            {d.cases.map((c) => {
              const x = p.cases[c];
              return (
                x && (
                  <div className="case-fig" key={c}>
                    <p className="sheet-h">
                      <a className="ref" href={x.href}>
                        {x.title}
                      </a>
                    </p>
                    {diagramNote(c) && <p className="sheet-src">{diagramNote(c)}</p>}
                    <Blocks blocks={x.blocks} secId={p.sec.cases} links={p.links} />
                  </div>
                )
              );
            })}
          </Sec>
        )}

        {bandTools.length > 0 && (
          <Sec id="m4" title="運用の内訳">
            <OpsList tools={bandTools} />
          </Sec>
        )}

        {qs.length > 0 && (
          <Sec id="m5" title="条件が違うとき">
            <DiffList
              items={diffs(kind, answers, look)}
              p={p}
              pick={(a) => {
                setAnswers(a);
                document.getElementById('memo-h')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              compare={(a) => {
                toCmp.current = true;
                setPinned(answers);
                setAnswers(a);
              }}
            />
          </Sec>
        )}

        <Sec id="m6" title="作り始める">
          <CommandList keys={[p.sec.commandsCommon, ...d.commands]} p={p} />
        </Sec>

        <Sec id="m7" title="次に読む">
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
        </Sec>
      </article>

      <aside className={unknown.size ? 'marg' : 'marg max-xl:hidden'} aria-label="傍注">
        {grounds.length > 0 && (
          <div className="marg-b max-xl:hidden">
            <p className="marg-k">根拠</p>
            {grounds.map((r) => (
              <p key={r.v}>
                <a className="ref" href={secHref(r.sec, r.sub, r.step)}>
                  {refText(r)}
                </a>{' '}
                の全文をこの欄に開く
              </p>
            ))}
          </div>
        )}
        <div className="marg-b max-xl:hidden">
          <p className="marg-k">記号</p>
          <Legend className="legend-list" />
        </div>
        {unknown.size > 0 && (
          <div className="marg-b">
            <p className="marg-k">未経験のツール　{unknown.size}</p>
            <p>
              {[...unknown].join('・')} は習熟度が「未経験」。検証期間を見積もりに入れる（
              <a className="ref" href={`/s/${p.sec.prof}/`}>
                習熟度表
              </a>
              ）。
            </p>
          </div>
        )}
      </aside>
      <PhoneBar copy={copy} />
    </div>
  );
}

/** A numbered part of the memo: number in the gutter, small heading, content */
function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="ms" id={id} aria-labelledby={`${id}-h`}>
      <h2 className="ms-h" id={`${id}-h`}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** "Hono（軽量…）" → ["Hono", "軽量…"]: a trailing parenthetical becomes the note column */
function splitNote(t: string): [string, string] {
  const i = t.indexOf('（');
  if (i <= 0 || !t.endsWith('）')) return [t, ''];
  let depth = 0;
  for (let k = i; k < t.length; k++) {
    if (t[k] === '（') depth++;
    else if (t[k] === '）' && --depth === 0 && k !== t.length - 1) return [t, ''];
  }
  return [t.slice(0, i), t.slice(i + 1, -1)];
}

/** Phone: the memo's own bar at the bottom (conditions, search, reopen references, copy) */
function PhoneBar({ copy }: { copy: () => string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const on = (e: Event) => setN((e as CustomEvent<{ count: number }>).detail.count);
    window.addEventListener('stackbook:trail', on);
    return () => window.removeEventListener('stackbook:trail', on);
  }, []);
  return (
    <nav className="pbar" aria-label="判定メモの操作">
      <a href="#memo-conds">条件</a>
      <button type="button" aria-haspopup="dialog" data-sheet-open>
        一覧
      </button>
      {/* Only once something has been looked up: until then there is nothing to reopen */}
      {n > 0 && (
        <button type="button" onClick={() => window.dispatchEvent(new Event('stackbook:reopen'))}>
          参照<span className="pbar-n">{n}</span>
        </button>
      )}
      <CopyButton text={copy} short />
    </nav>
  );
}

/** What the 差替 badge and the ops marks in the stack table mean */
function Legend({ className }: { className: string }) {
  return (
    <ul className={className}>
      <li>
        <span className="ed-badge">差替</span>条件で既定から差し替えた行
      </li>
      {BANDS.map((b) => (
        <li key={b.ops}>
          <span className={`om om-${b.ops}`} aria-hidden="true" />
          {b.label}
        </li>
      ))}
    </ul>
  );
}

function CommandList({ keys, p }: { keys: string[]; p: MakePayload }) {
  const list = keys.map((k) => [k, p.cmds[k]] as const).filter(([, c]) => c);
  return list.map(([k, c]) => (
    <div key={k} className="cmds">
      <h3>{c.title}</h3>
      <Blocks blocks={c.blocks} secId={p.sec.commands} links={p.links} />
    </div>
  ));
}

type Q = ReturnType<typeof questionsFor>[number];
/** The conditions, always in view: a "label  value" row per question, checkboxes for the constraints */
function Conditions({
  qs,
  answers,
  set,
}: {
  qs: Q[];
  answers: Answers;
  set: (q: keyof Answers, v: string, multi?: boolean) => void;
}) {
  if (!qs.length)
    return (
      <p className="conds-none" id="memo-conds">
        この種類は、条件によって構成が変わらない。
      </p>
    );
  return (
    <form className="conds" id="memo-conds" aria-label="条件" onSubmit={(e) => e.preventDefault()}>
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

/** Two condition sets side by side: A (pinned) and B (current), differing rows marked */
function Compare({
  kind,
  a,
  b,
  look,
  p,
  summaryOf,
  restore,
  unpin,
}: {
  kind: Kind;
  a: Answers;
  b: Answers;
  look: Lookup;
  p: MakePayload;
  summaryOf: (a: Answers) => string;
  restore: () => void;
  unpin: () => void;
}) {
  const da = decide(kind, a);
  const db = decide(kind, b);
  const rows = (d: Decision) => new Map(d.tables.flatMap((t) => resolve(t, look)).map((r) => [r.layer, r]));
  const ra = rows(da);
  const rb = rows(db);
  const layers = [...new Set([...ra.keys(), ...rb.keys()])];
  // The recommendation row only repeats the language row when both name the same language
  const sameAsLang = (d: Decision, r: typeof ra) => r.get('言語')?.text.replaceAll('**', '') === d.title;
  const lines = [
    ...(sameAsLang(da, ra) && sameAsLang(db, rb) ? [] : [{ k: '推奨', a: da.title, b: db.title }]),
    ...layers.map((l) => ({ k: l, a: ra.get(l)?.text ?? '', b: rb.get(l)?.text ?? '' })),
  ];
  const md = () =>
    [
      `# ${KINDS.find((k) => k[0] === kind)?.[1] ?? kind}：条件の比較`,
      '',
      `- A：${summaryOf(a)}`,
      `- B：${summaryOf(b)}`,
      '',
      '| | A | B |',
      '|---|---|---|',
      ...lines.map((x) => `| ${x.k}${x.a === x.b ? '' : '（違う）'} | ${x.a || '—'} | ${x.b || '—'} |`),
      '',
    ].join('\n');
  const cell = (t: string, side: string) => (
    <td data-k={side}>
      {/* One wrapper, so the value is a single grid item beside the A/B marker on phones */}
      <span>{t ? <Inline text={t.replaceAll('**', '')} /> : <span className="text-faint">—</span>}</span>
    </td>
  );
  return (
    <section className="blk cmp-box" id="cmp" aria-labelledby="cmp-h">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="sh" id="cmp-h">
          比較<span className="sh-d">違う行に ≠</span>
        </h2>
        <span className="cmp-acts">
          <CopyButton text={md} small />
          <button type="button" className="btn btn-s" onClick={restore}>
            {/* One flex item, so the space after 条件を is not trimmed */}
            <span>
              <span className="max-sm:sr-only">条件を </span>A に戻す
            </span>
          </button>
          <button type="button" className="btn btn-s" onClick={unpin}>
            比較をやめる
          </button>
        </span>
      </div>
      {/* Phones hide the table head, so the two condition sets are named here */}
      <div className="cmp-leg" aria-hidden="true">
        <p>
          <span>A</span>
          {summaryOf(a)}
        </p>
        <p>
          <span>B</span>
          {summaryOf(b)}
        </p>
      </div>
      {lines.every((x) => x.a === x.b) && (
        <p className="cmp-hint">いまは A と B が同じ条件。上の条件を変えると B だけが変わり、違う行に ≠ が付く。</p>
      )}
      <LinksContext.Provider value={p.links}>
        <table className="cmp">
          <thead>
            <tr>
              <td />
              <th scope="col">
                A（固定）<span className="cmp-s">{summaryOf(a)}</span>
              </th>
              <th scope="col">
                B（今の条件）<span className="cmp-s">{summaryOf(b)}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((x) => {
              const same = x.a === x.b;
              return (
                <tr key={x.k} className={same ? undefined : 'cmp-d'}>
                  <th scope="row">
                    {!same && (
                      <span className="cmp-ne" role="img" aria-label="違う">
                        ≠
                      </span>
                    )}
                    {x.k}
                  </th>
                  {cell(x.a, 'A')}
                  {cell(x.b, 'B')}
                </tr>
              );
            })}
          </tbody>
        </table>
      </LinksContext.Provider>
    </section>
  );
}

/** What changes if one condition were different, with buttons to switch to it or compare */
function DiffList({
  items,
  p,
  pick,
  compare,
}: {
  items: Diff[];
  p: MakePayload;
  pick: (a: Answers) => void;
  compare: (a: Answers) => void;
}) {
  if (!items.length) return null;
  return (
    <ul className="diffs">
      {items.map((x) => (
        <li key={`${x.q}:${x.v}`}>
          <span className="df-k">{x.label}</span>
          <ul className="df-c">
            {x.title && (
              <li>
                推奨 → <strong>{x.title}</strong>
              </li>
            )}
            {x.base && (
              <li>
                構成 →{' '}
                <a className="ref" href={`/s/${p.sec.cases}/#${x.base}`}>
                  {p.titles[x.base] ?? x.base}
                </a>
              </li>
            )}
            {x.rebuilt && <li>構成 → 言語別の既定から組み立て直す</li>}
            {!x.base &&
              !x.rebuilt &&
              x.rows
                // 推奨 above already names the language
                .filter((r) => !(x.title && r.layer === '言語' && r.text.replaceAll('**', '') === x.title))
                .map((r) => (
                  <li key={r.layer}>
                    {/* Plain throughout: the sources bold some names and not others */}
                    {r.layer} → <Inline text={r.text.replaceAll('**', '')} />
                  </li>
                ))}
            {x.removed.map((l) => (
              <li key={l}>{l} → なくなる</li>
            ))}
          </ul>
          <span className="df-b">
            <button type="button" className="btn btn-s" onClick={() => pick(x.answers)}>
              この条件に切り替える
            </button>
            <button type="button" className="btn btn-s btn-q" onClick={() => compare(x.answers)}>
              並べて比べる
            </button>
          </span>
        </li>
      ))}
    </ul>
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

function CopyButton({
  text,
  primary,
  short,
  small,
}: {
  text: () => string;
  primary?: boolean;
  short?: boolean;
  small?: boolean;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={short ? undefined : primary ? 'btn btn-primary' : small ? 'btn btn-s' : 'btn'}
      onClick={() =>
        navigator.clipboard?.writeText(text()).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })
      }
    >
      {done ? (
        'コピーしました'
      ) : short ? (
        'コピー'
      ) : small ? (
        <>
          <span className="max-sm:sr-only">Markdownで</span>コピー
        </>
      ) : (
        'Markdownでコピー'
      )}
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

/** The stack split by who runs each part, one column each */
function OpsList({ tools }: { tools: MakeTool[] }) {
  const groups = BANDS.map((b) => ({ ...b, names: tools.filter((t) => t.ops === b.ops).map((t) => t.name) })).filter(
    (g) => g.names.length,
  );
  return (
    <div className="ops3">
      {groups.map((g) => (
        <div key={g.ops}>
          <p className="ops3-h">
            <span className={`om om-${g.ops}`} aria-hidden="true" />
            {g.label}
            <span className="ops3-n">{g.names.length}</span>
          </p>
          <p className="ops3-v">
            {g.names.map((n, i) => (
              <span key={n}>
                {n}
                {i < g.names.length - 1 && '、'}
              </span>
            ))}
          </p>
        </div>
      ))}
    </div>
  );
}

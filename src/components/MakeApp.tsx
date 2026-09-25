import { useEffect, useMemo, useState } from 'react';
import type { Block } from '../lib/guide';
import type { ToolView } from '../lib/view';
import { type Answers, DEFAULTS, decide, type Kind, QUESTIONS, SHOW } from '../lib/wizard';
import { Blocks } from './Blocks';
import { Inline, type Links } from './Inline';
import { ToolBody } from './ToolBody';

export type MakePayload = {
  tools: Record<string, ToolView>;
  links: Links;
  cases: Record<string, { title: string; href: string; blocks: Block[] }>;
  /** Command blocks keyed by §19 case id; "" holds the common setup */
  cmds: Record<string, { title: string; blocks: Block[] }>;
  refs: Record<string, { href: string; label: string }>;
  /** Section ids used in messages */
  sec: { prof: string; cases: string; commands: string };
};

const PKEY = 'stackbook:prof';
const readProf = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(PKEY) || '{}');
  } catch {
    return {};
  }
};

export default function MakeApp({ kind, payload: p }: { kind: Kind; payload: MakePayload }) {
  const [answers, setAnswers] = useState<Answers>(DEFAULTS);
  const [prof, setProf] = useState<Record<string, string>>({});
  const d = useMemo(() => decide(kind, answers), [kind, answers]);
  const qs = QUESTIONS.filter((q) => SHOW[q.q].includes(kind));

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

  const unknown = new Set<string>();
  const rows = d.rows.map((r) => {
    const tools = r.tools.map((id) => p.tools[id]).filter(Boolean);
    const warn = [...new Set(tools.flatMap((t) => t.prof).filter((n) => prof[n] === '未経験'))];
    for (const w of warn) unknown.add(w);
    return { ...r, cards: tools, warn };
  });

  return (
    <>
      {qs.length > 0 && (
        <form className="conds mt-8" onSubmit={(e) => e.preventDefault()}>
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
      )}

      <p className="sr-only" aria-live="polite">
        推奨：{d.title}
      </p>
      <div className="mt-8">
        <section className="answer">
          <p className="eyebrow">推奨</p>
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
            構成<span className="sh-d">行を開くと、乗り換える条件・根拠・費用・習熟度</span>
          </h2>
          <div className="sheet">
            {rows.map((r) => {
              const head = (
                <>
                  <span className="s-layer">{r.layer}</span>
                  <span className="s-val">
                    <Inline text={r.text} linkTools={false} />
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
                          <a href={`/dict/${t.slug}/`}>{t.name}</a>
                        </h3>
                        <ToolBody tool={t} links={p.links} />
                      </section>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
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
                <Blocks blocks={x.blocks} secId={p.sec.cases} links={p.links} />
              </section>
            )
          );
        })}

        <CommandList keys={['', ...d.cases]} p={p} />

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

import type { CSSProperties, ReactNode } from 'react';
import type { Block } from '../lib/guide';
import { HEADS } from '../lib/heads';
import { refText, secHref, segments } from '../lib/inline';
import type { Data } from '../lib/schema';
import { Inline, type Links, LinksContext } from './Inline';

const LEVELS = ['未経験', '検証済み', '実務'];
/** Three buttons for a tool's proficiency (pressing the chosen one again clears it); kept in localStorage */
export const ProfSeg = ({ name }: { name: string }) => (
  <fieldset className="seg" aria-label={`${name}の習熟度`}>
    {LEVELS.map((l) => (
      <button key={l} type="button" data-prof={name} data-level={l} aria-pressed="false">
        {l}
      </button>
    ))}
  </fieldset>
);
const FILTERS = [['', 'すべて'], ['unset', '未設定'], ...LEVELS.map((l) => [l, l])];

type Alt = Extract<Data, { kind: 'choices' }>['rows'][number]['alts'][number];
export const Alts = ({ alts, names }: { alts: Alt[]; names: (ids: string[]) => string }) =>
  alts.length ? (
    <ul className="alts">
      {alts.map((a) => (
        <li key={`${a.name}${a.tools.join()}${a.when}`}>
          <span className="alt-n">
            <Inline text={a.name ?? names(a.tools)} tools={a.tools} />
          </span>
          {a.when && (
            <span className="alt-c">
              <Inline text={a.when} />
            </span>
          )}
        </li>
      ))}
    </ul>
  ) : null;

export const KV = ({ pairs, className = 'kv' }: { pairs: [string, ReactNode | undefined][]; className?: string }) => (
  <dl className={className}>
    {pairs
      .filter(([, v]) => v)
      .map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
  </dl>
);

const Rec = ({ title, fields }: { title: ReactNode; fields: [string | undefined, ReactNode | undefined][] }) => (
  <article className="rec">
    <h4>{title}</h4>
    {fields.map(([k, v], i) =>
      v ? (
        <p key={i}>
          <span className="rec-k">{k}</span>
          {v}
        </p>
      ) : null,
    )}
  </article>
);

const I = (text: string | undefined, tools?: string[]) => (text ? <Inline text={text} tools={tools} /> : undefined);

function DataBlock({ d, names }: { d: Data; names: (ids: string[]) => string }) {
  const h = d.head ?? HEADS[d.kind];
  switch (d.kind) {
    case 'choices':
      return (
        <div className="choices">
          {d.rows.map((r) => (
            <div className="ch" key={r.role}>
              <div className="ch-role">
                <Inline text={r.role} />
              </div>
              <div className="ch-main">
                <div className="ch-pick">
                  <Inline text={r.default} tools={r.tools} />
                </div>
                <Alts alts={r.alts} names={names} />
                {r.note && (
                  <p className="ch-note">
                    <Inline text={r.note} />
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    case 'stack':
      return <KV pairs={d.rows.map((r) => [r.layer, I(r.pick, r.tools)])} />;
    case 'prof':
      return (
        <div className="prof">
          <fieldset className="prof-f" aria-label="習熟度で絞り込む">
            {FILTERS.map(([v, l]) => (
              <button key={v} type="button" data-pf={v} aria-pressed={v === '' ? 'true' : 'false'}>
                {l}
                <span className="pf-n" data-pf-n={v} />
              </button>
            ))}
          </fieldset>
          <div className="prof-grid">
            {[...new Set(d.rows.map((r) => r.kind))].map((k) => (
              <section className="pg" key={k}>
                <h3 className="pg-k">{k}</h3>
                <ul>
                  {d.rows
                    .filter((r) => r.kind === k)
                    .map((r) => (
                      <li className="pl" data-pl={r.name} key={r.name}>
                        <span className="pl-n">{r.name}</span>
                        <ProfSeg name={r.name} />
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      );
    case 'uses':
      return (
        <div className="recs">
          {d.rows.map((r) => (
            <Rec
              key={r.situation}
              title={I(r.situation)}
              fields={[
                [h[1], I(r.pick, r.tools)],
                [h[2], I(r.next)],
                [h[3], I(r.example)],
                [h[4], I(r.reason)],
              ]}
            />
          ))}
        </div>
      );
    case 'rationale':
      return (
        <div className="recs">
          {d.rows.map((r) => (
            <Rec
              key={r.name}
              title={I(r.name, r.tools)}
              fields={[
                [h[1], I(r.why)],
                [h[2], I(r.concern)],
              ]}
            />
          ))}
        </div>
      );
    case 'growth':
      return (
        <div className="recs">
          {d.rows.map((r) => (
            <Rec
              key={r.from + r.to}
              title={
                <>
                  {I(r.from, r.tools)} → {I(r.to, r.to_tools)}
                </>
              }
              fields={[
                [h[2], I(r.trigger)],
                [h[3], I(r.prepare)],
              ]}
            />
          ))}
        </div>
      );
    case 'cost':
      return (
        <div className="recs">
          {d.rows.map((r) => (
            <Rec
              key={r.service}
              title={I(r.service, r.tools)}
              fields={[
                [h[1], I(r.axis)],
                [h[2], r.grows === '—' ? undefined : I(r.grows)],
                [h[3], I(r.action)],
              ]}
            />
          ))}
        </div>
      );
  }
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  const cell = (c: string) => (c && c !== '—' ? <Inline text={c} /> : <span className="none">—</span>);
  const long = rows.some((r) => r.some((c) => c.length > 34));
  if (head.length <= 2 && !long) return <KV pairs={rows.map((r) => [r[0].replace(/\*\*|`/g, ''), cell(r[1] ?? '')])} />;
  if (!long)
    return (
      <div className="tw">
        <table>
          <thead>
            <tr>
              {head.map((x) => (
                <th key={x}>
                  <Inline text={x} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.join('|')}>
                {r.map((c, k) => (
                  <td key={head[k] ?? k} data-label={head[k] ?? ''}>
                    {cell(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return (
    <div className="recs">
      {rows.map((r) => (
        <Rec
          key={r.join('|')}
          title={<Inline text={r[0]} />}
          fields={r.slice(1).map((c, k) => [head[k + 1], c && c !== '—' ? <Inline text={c} /> : undefined])}
        />
      ))}
    </div>
  );
}

// Stable key for a checklist item, so saved state survives reordering (FNV-1a)
const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
};

function BlockView({ b, secId, names }: { b: Block; secId: string; names: (ids: string[]) => string }) {
  switch (b.t) {
    case 'h3':
      return (
        <h3 id={b.id}>
          <Inline text={b.text} />
        </h3>
      );
    case 'h4':
      return (
        <h4 id={b.id}>
          <Inline text={b.text} />
        </h4>
      );
    case 'p':
      return (
        <p>
          <Inline text={b.text} />
        </p>
      );
    case 'ul':
    case 'ol': {
      const List = b.t;
      return (
        <List>
          {b.items.map((t) => (
            <li key={t}>
              <Inline text={t} />
            </li>
          ))}
        </List>
      );
    }
    case 'check':
      return (
        <>
          <div className="ck-prog" data-ck-prog={secId}>
            <span className="ck-bar" aria-hidden="true">
              {b.items.map((t) => (
                <i key={t} data-ck-seg={`${secId}:${hash(t)}`} />
              ))}
            </span>
            <span className="ck-n" aria-live="polite" />
          </div>
          <ol className="check">
            {b.items.map((t) => (
              <li key={t}>
                <label>
                  <input type="checkbox" data-ck={`${secId}:${hash(t)}`} />
                  <span>
                    <Inline text={t} />
                  </span>
                </label>
                <span className="ck-refs">
                  {segments(t).flatMap((x) =>
                    x.t === 'ref'
                      ? [
                          <a key={x.v} className="ck-chip" href={secHref(x.sec, x.sub, x.step)}>
                            {refText(x)}
                          </a>,
                        ]
                      : [],
                  )}
                </span>
              </li>
            ))}
          </ol>
        </>
      );
    case 'code':
      return (
        <div className="code">
          <button type="button" className="copy">
            コピー
          </button>
          <pre>
            <code>{b.text}</code>
          </pre>
        </div>
      );
    case 'mermaid':
      return (
        <figure className="diagram">
          <button type="button" className="diagram-zoom" data-zoom aria-label="構成図を拡大して開く">
            拡大
          </button>
          {/* Pre-rendered at build time from our own guide content (scripts/diagrams.mjs) */}
          <div
            className="diagram-svg"
            style={
              { '--dw': `${Math.min(Number(b.svg.match(/max-width: ([\d.]+)px/)?.[1] ?? 0), 720)}px` } as CSSProperties
            }
            dangerouslySetInnerHTML={{ __html: b.svg }}
          />
          <figcaption className="legend">
            <span>
              <span className="om om-code" />
              自分で書く
            </span>
            <span>
              <span className="om om-self" />
              自分で運用する
            </span>
            <span>
              <span className="om om-managed" />
              マネージドに任せる
            </span>
            <span>
              <span className="om om-none" />
              灰色の地：分類なし
            </span>
          </figcaption>
        </figure>
      );
    case 'table':
      return <Table head={b.head} rows={b.rows} />;
    default:
      return <DataBlock d={b.d} names={names} />;
  }
}

type Props = { blocks: Block[]; secId: string; links: Links };
export function Blocks({ blocks, secId, links }: Props) {
  const names = (ids: string[]) => ids.map((id) => links[id]?.name ?? id).join('＋');
  return (
    <LinksContext.Provider value={links}>
      {blocks.map((b, i) => (
        <BlockView key={i} b={b} secId={secId} names={names} />
      ))}
    </LinksContext.Provider>
  );
}

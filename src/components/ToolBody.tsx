import type { ReactNode } from 'react';
import { HEADS } from '../lib/heads';
import { secHref } from '../lib/inline';
import type { ToolView, Where } from '../lib/view';
import { Alts, KV, ProfSelect } from './Blocks';
import { Inline, type Links, LinksContext } from './Inline';

const Ref = ({ id, sub }: { id: string; sub?: string }) => (
  <a className="ref" href={secHref(id, sub)}>
    §{sub ?? id}
  </a>
);
const WhereLink = ({ w }: { w: Where }) => (
  <a className="ref" href={w.href}>
    {w.label}
  </a>
);
const Head = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <p className="tb-h">
    <span>{children}</span>
    {right && <span className="tb-w">{right}</span>}
  </p>
);

/** Everything the guide says about one tool, grouped by purpose */
export function ToolBody({ tool: t, links }: { tool: ToolView; links: Links }) {
  const names = (ids: string[]) => ids.map((id) => links[id]?.name ?? id).join('＋');
  return (
    <LinksContext.Provider value={links}>
      {t.lang && (
        <div className="tb">
          <Head right={<Ref id="2" sub={t.lang.ref} />}>言語別の既定</Head>
          {t.lang.lead && (
            <p>
              <Inline text={t.lang.lead} />
            </p>
          )}
        </div>
      )}
      {t.uses.length > 0 && (
        <div className="tb">
          <Head right={<Ref id="2" sub="2-10" />}>選ぶ場面</Head>
          <ul className="uses">
            {t.uses.map((u) => (
              <li key={u.situation}>
                <strong>
                  <Inline text={u.situation} />
                </strong>
                {u.reason && (
                  <span>
                    <Inline text={u.reason} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {t.def.map((r) => (
        <div className="tb" key={`d${r.where.href}${r.role}`}>
          <Head right={<WhereLink w={r.where} />}>
            既定：
            <Inline text={r.role} />
          </Head>
          {r.alts.length > 0 && <p className="tb-k">乗り換える条件</p>}
          <Alts alts={r.alts} names={names} />
          {r.note && (
            <p className="ch-note">
              <Inline text={r.note} />
            </p>
          )}
        </div>
      ))}
      {t.alt.map((r) => (
        <div className="tb" key={`a${r.where.href}${r.role}`}>
          <Head right={<WhereLink w={r.where} />}>
            代替：
            <Inline text={r.role} />
          </Head>
          <p>
            既定は <Inline text={r.default} tools={r.tools} />
            {r.when && (
              <>
                。
                <strong>
                  <Inline text={r.when} />
                </strong>{' '}
                に乗り換える
              </>
            )}
            。
          </p>
        </div>
      ))}
      {t.why.map((e) => (
        <div className="tb" key={e.why}>
          <Head right={<Ref id={t.refs.why} sub={t.refs.whySub} />}>採用の根拠</Head>
          <p>
            <Inline text={e.why} />
          </p>
          {e.concern && (
            <p className="qa">
              <Inline text={e.concern} />
            </p>
          )}
        </div>
      ))}
      {t.cost.map((e) => (
        <div className="tb" key={e.axis}>
          <Head right={<Ref id={t.refs.cost} />}>費用の注意</Head>
          <KV
            className="kv sm"
            pairs={[
              [HEADS.cost[1], <Inline key="a" text={e.axis} />],
              [HEADS.cost[2], e.grows === '—' ? undefined : <Inline key="g" text={e.grows} />],
              [HEADS.cost[3], <Inline key="c" text={e.action} />],
            ]}
          />
        </div>
      ))}
      {t.growth.map((e) => (
        <div className="tb" key={e.to + e.trigger}>
          <Head right={<Ref id={t.refs.growth} />}>
            成長したら → <Inline text={e.to} tools={e.to_tools} />
          </Head>
          <KV
            className="kv sm"
            pairs={[
              ['きっかけ', <Inline key="t" text={e.trigger} />],
              ['最初からの備え', <Inline key="p" text={e.prepare} />],
            ]}
          />
        </div>
      ))}
      {t.stacks.length > 0 && (
        <div className="tb">
          <Head right={<Ref id="19" />}>ケース別の構成</Head>
          <ul className="uses">
            {t.stacks.map((s) => (
              <li key={s.label + s.layer}>
                <strong>{s.label}</strong>
                <span>
                  <Inline text={`${s.layer}：${s.pick}`} tools={s.tools.filter((id) => id !== t.id)} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {t.prof.map((name) => (
        <div className="tb tb-prof" key={name}>
          <Head>習熟度</Head>
          <ProfSelect name={name} />
        </div>
      ))}
    </LinksContext.Provider>
  );
}

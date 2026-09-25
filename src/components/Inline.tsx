import { createContext, Fragment, type ReactNode, useContext } from 'react';
import { findName, refText, type Seg, screenSegments, secHref } from '../lib/inline';

/** Tool id → display name and link target (dictionary page or official site), for linking names inside text */
export type Links = Record<string, { name: string; href: string }>;
export const LinksContext = createContext<Links>({});

type Props = {
  text: string;
  /** Ids of tools whose first whole-word occurrence becomes a dictionary link */
  tools?: string[];
};

export function Inline({ text, tools = [] }: Props) {
  const links = useContext(LinksContext);
  const pending = tools.flatMap((id) => (links[id] ? [{ id, ...links[id] }] : []));

  // Links each pending tool name once, in text order
  const linkify = (v: string, key: string): ReactNode[] => {
    for (const [n, l] of pending.entries()) {
      const hit = findName(v, l.name);
      if (!hit) continue;
      pending.splice(n, 1);
      return [
        ...linkify(hit[0], `${key}a`),
        <a key={key} className="tl" href={l.href}>
          {l.name}
        </a>,
        ...linkify(hit[1], `${key}b`),
      ];
    }
    return v ? [v] : [];
  };
  const render = (s: Seg, i: number): ReactNode => {
    switch (s.t) {
      case 'code':
        return <code key={i}>{s.v}</code>;
      case 'bold':
        return <strong key={i}>{linkify(s.v, `${i}`)}</strong>;
      case 'ref':
        return (
          <a key={i} className="ref" href={secHref(s.sec, s.sub, s.step)}>
            {refText(s)}
          </a>
        );
      case 'url':
        return (
          <a key={i} className="ref" href={s.v} rel="noopener">
            {s.v}
          </a>
        );
      default:
        return <Fragment key={i}>{linkify(s.v, `${i}`)}</Fragment>;
    }
  };
  return <>{screenSegments(text).map(render)}</>;
}

import { createContext, Fragment, type ReactNode, useContext } from 'react';
import { findName, type Seg, secHref, segments } from '../lib/inline';

/** Tool id → display name and link target (dictionary page or official site), for linking names inside text */
export type Links = Record<string, { name: string; href: string }>;
export const LinksContext = createContext<Links>({});

type Props = {
  text: string;
  /** Ids of tools whose first whole-word occurrence becomes a dictionary link */
  tools?: string[];
  /** Set false to render tool names as plain text (e.g. inside a clickable row) */
  linkTools?: boolean;
  /** Drawn before each tool name found in the text */
  mark?: (id: string) => ReactNode;
};

export function Inline({ text, tools = [], linkTools = true, mark }: Props) {
  const links = useContext(LinksContext);
  const pending = linkTools || mark ? tools.flatMap((id) => (links[id] ? [{ id, ...links[id] }] : [])) : [];

  // Links each pending tool name once, in text order
  const linkify = (v: string, key: string): ReactNode[] => {
    for (const [n, l] of pending.entries()) {
      const hit = findName(v, l.name);
      if (!hit) continue;
      pending.splice(n, 1);
      const name = linkTools ? (
        <a key={key} className="tl" href={l.href}>
          {l.name}
        </a>
      ) : (
        <Fragment key={key}>{l.name}</Fragment>
      );
      return [
        ...linkify(hit[0], `${key}a`),
        ...(mark ? [<Fragment key={`${key}m`}>{mark(l.id)}</Fragment>] : []),
        name,
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
            {s.v}
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
  return <>{segments(text).map(render)}</>;
}

import { createContext, Fragment, type ReactNode, useContext } from 'react';
import { findName, type Seg, secHref, segments, toolHref } from '../lib/inline';

/** Tool id → display name and dictionary slug, for linking names inside text */
export type Links = Record<string, { name: string; slug: string }>;
export const LinksContext = createContext<Links>({});

type Props = {
  text: string;
  /** Ids of tools whose first whole-word occurrence becomes a dictionary link */
  tools?: string[];
  /** Set false to render tool names as plain text (e.g. inside a clickable row) */
  linkTools?: boolean;
};

export function Inline({ text, tools = [], linkTools = true }: Props) {
  const links = useContext(LinksContext);
  const pending = linkTools ? tools.map((id) => links[id]).filter(Boolean) : [];

  // Links each pending tool name once, in text order
  const linkify = (v: string, key: string): ReactNode[] => {
    for (const [n, l] of pending.entries()) {
      const hit = findName(v, l.name);
      if (!hit) continue;
      pending.splice(n, 1);
      return [
        ...linkify(hit[0], `${key}a`),
        <a key={key} className="tl" href={toolHref(l.slug)}>
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
          <a key={i} className="ref" href={secHref(s.sec, s.sub)}>
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

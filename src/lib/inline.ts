// Tokenizer for the inline markdown used in the guide: `code`, **bold**, §N / §N-M, bare URLs

export type Seg =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'ref'; v: string; sec: string; sub?: string }
  | { t: 'url'; v: string };

const RE = /`([^`]+)`|\*\*([^*]+)\*\*|§(\d+)(?:-(\d+))?|(https?:\/\/[^\s<）)、。]+)/g;

export function segments(text: string): Seg[] {
  const out: Seg[] = [];
  let last = 0;
  for (const m of text.matchAll(RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ t: 'text', v: text.slice(last, i) });
    if (m[1] !== undefined) out.push({ t: 'code', v: m[1] });
    else if (m[2] !== undefined) out.push({ t: 'bold', v: m[2] });
    else if (m[3] !== undefined) out.push({ t: 'ref', v: m[0], sec: m[3], sub: m[4] && `${m[3]}-${m[4]}` });
    else out.push({ t: 'url', v: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

const isWord = (c: string | undefined) => !!c && /[A-Za-z0-9_.#+-]/.test(c);

/** Splits plain text around the first whole-word occurrence of `name` */
export function findName(text: string, name: string): [string, string] | null {
  let i = text.indexOf(name);
  while (i >= 0 && (isWord(text[i - 1]) || isWord(text[i + name.length]))) i = text.indexOf(name, i + 1);
  return i < 0 ? null : [text.slice(0, i), text.slice(i + name.length)];
}

export const secHref = (id: string, sub?: string) => `/s/${id}/${sub ? `#${sub}` : ''}`;
export const toolHref = (slug: string) => `/dict/${slug}/`;

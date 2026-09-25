// Tokenizer for the inline markdown used in the guide: `code`, **bold**, §N / §N-M / §N-M 手順K, [text](url), bare URLs

export type Seg =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'ref'; v: string; sec: string; sub?: string; step?: string }
  | { t: 'url'; v: string; label?: string };

const RE =
  /`([^`]+)`|\*\*([^*]+)\*\*|§(\d+)(?:-(\d+)(?: ?手順(\d+))?)?|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<）)、。]+)/g;

export function segments(text: string): Seg[] {
  const out: Seg[] = [];
  let last = 0;
  for (const m of text.matchAll(RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ t: 'text', v: text.slice(last, i) });
    if (m[1] !== undefined) out.push({ t: 'code', v: m[1] });
    else if (m[2] !== undefined) out.push({ t: 'bold', v: m[2] });
    else if (m[3] !== undefined) out.push({ t: 'ref', v: m[0], sec: m[3], sub: m[4] && `${m[3]}-${m[4]}`, step: m[5] });
    else if (m[6] !== undefined) out.push({ t: 'url', v: m[7], label: m[6] });
    else out.push({ t: 'url', v: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

/** Segments for the screen, where references show names: drops the half-width space that sets off "§N" in the source
 * when the neighbour is Japanese ("§24 の" → "…の") */
export function screenSegments(text: string): Seg[] {
  const segs = segments(text);
  const wide = (c: string | undefined) => !!c && c.charCodeAt(0) > 0x2e7f;
  return segs.map((x, i) => {
    if (x.t !== 'text') return x;
    let v = x.v;
    if (segs[i - 1]?.t === 'ref' && v.startsWith(' ') && wide(v[1])) v = v.slice(1);
    if (segs[i + 1]?.t === 'ref' && v.endsWith(' ') && wide(v.at(-2))) v = v.slice(0, -1);
    return { ...x, v };
  });
}

const isWord = (c: string | undefined) => !!c && /[A-Za-z0-9_.#+-]/.test(c);

/** Splits plain text around the first whole-word occurrence of `name` */
export function findName(text: string, name: string): [string, string] | null {
  let i = text.indexOf(name);
  while (i >= 0 && (isWord(text[i - 1]) || isWord(text[i + name.length]))) i = text.indexOf(name, i + 1);
  return i < 0 ? null : [text.slice(0, i), text.slice(i + name.length)];
}

/** Anchor of a step heading (#### 手順K) inside subsection N-M */
export const stepId = (sub: string, step: string) => `${sub}-s${step}`;
/** A reference as shown on screen: its target's name (and step), not the number */
export const refText = (x: { v: string; sec: string; sub?: string; step?: string }) => {
  const names = (globalThis as { __stackbookTitles?: Record<string, string> }).__stackbookTitles ?? {};
  const name = names[x.sub ?? x.sec];
  if (!name) return x.v.replace(/^§/, '');
  return x.step ? `${name}・手順${x.step}` : name;
};
export const secHref = (id: string, sub?: string, step?: string) =>
  `/s/${id}/${sub ? `#${step ? stepId(sub, step) : sub}` : ''}`;
export const toolHref = (slug: string) => `/dict/${slug}/`;
